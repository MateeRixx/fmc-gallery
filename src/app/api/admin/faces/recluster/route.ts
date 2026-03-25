import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/middleware";
import { Permission } from "@/types";
import {
  cosineDistance,
  mergeCentroid,
  parsePgVector,
  vectorToPgString,
} from "@/lib/faceClusters";
import { searchFacesByFaceId } from "@/lib/awsRekognition";

export const runtime = "nodejs";

type ExistingCluster = {
  id: number;
  centroid: number[];
  count: number;
  coverPhotoId: string | null;
  assignedFaceIds: number[];
};

type PendingCluster = {
  centroid: number[];
  count: number;
  coverPhotoId: string;
  assignedFaceIds: number[];
};

type AwsFaceRow = {
  id: number;
  photo_id: string;
  aws_face_id: string;
  quality_score: number;
  embedding: number[];
};

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(a: number, b: number) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent[rootB] = rootA;
    }
  }
}

async function runVectorClustering(params: {
  supabase: any;
  threshold: number;
  minQuality: number;
  reset: boolean;
}) {
  const { supabase, threshold, minQuality, reset } = params;

  const { data: clusterRows, error: clusterRowsError } = await supabase
    .from("face_clusters")
    .select("id, canonical_embedding, face_count, cover_photo_id")
    .order("id", { ascending: true });

  if (clusterRowsError) {
    return { error: clusterRowsError.message };
  }

  const existingClusters: ExistingCluster[] = (clusterRows || [])
    .map((row: any) => {
      const centroid = parsePgVector(row.canonical_embedding);
      return {
        id: Number(row.id),
        centroid,
        count: Number(row.face_count || 0),
        coverPhotoId: row.cover_photo_id ? String(row.cover_photo_id) : null,
        assignedFaceIds: [],
      };
    })
    .filter((cluster: ExistingCluster) => cluster.centroid.length === 128);

  let faceQuery = supabase
    .from("face_embeddings")
    .select("id, photo_id, embedding, quality_score")
    .order("id", { ascending: true });

  if (!reset) {
    faceQuery = faceQuery.is("cluster_id", null);
  }

  const { data: faceRows, error: faceRowsError } = await faceQuery;

  if (faceRowsError) {
    return { error: faceRowsError.message };
  }

  const pendingClusters: PendingCluster[] = [];
  let processedFaces = 0;
  let skippedFaces = 0;
  const distanceLogs: string[] = [];

  for (const row of faceRows || []) {
    const embedding = parsePgVector(row.embedding);
    const quality = Number(row.quality_score || 0);
    const faceId = Number(row.id);
    const photoId = String(row.photo_id || "");

    if (!photoId || embedding.length !== 128 || quality < minQuality || !Number.isFinite(faceId)) {
      skippedFaces += 1;
      continue;
    }

    processedFaces += 1;

    let bestExistingIndex = -1;
    let bestPendingIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < existingClusters.length; i += 1) {
      const distance = cosineDistance(existingClusters[i].centroid, embedding);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestExistingIndex = i;
        bestPendingIndex = -1;
      }
    }

    for (let i = 0; i < pendingClusters.length; i += 1) {
      const distance = cosineDistance(pendingClusters[i].centroid, embedding);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestExistingIndex = -1;
        bestPendingIndex = i;
      }
    }

    if (processedFaces <= 10) {
      distanceLogs.push(
        `Face ${faceId}: bestDistance=${bestDistance.toFixed(4)}, threshold=${threshold}, pendingClusters=${pendingClusters.length}`
      );
    }

    if (bestDistance <= threshold && bestExistingIndex >= 0) {
      const cluster = existingClusters[bestExistingIndex];
      cluster.assignedFaceIds.push(faceId);
      cluster.centroid = mergeCentroid(cluster.centroid, cluster.count, embedding);
      cluster.count += 1;
      if (!cluster.coverPhotoId) {
        cluster.coverPhotoId = photoId;
      }
      continue;
    }

    if (bestDistance <= threshold && bestPendingIndex >= 0) {
      const cluster = pendingClusters[bestPendingIndex];
      cluster.assignedFaceIds.push(faceId);
      cluster.centroid = mergeCentroid(cluster.centroid, cluster.count, embedding);
      cluster.count += 1;
      continue;
    }

    pendingClusters.push({
      centroid: embedding,
      count: 1,
      coverPhotoId: photoId,
      assignedFaceIds: [faceId],
    });
  }

  let createdClusters = 0;
  if (pendingClusters.length > 0) {
    const insertPayload = pendingClusters.map((cluster) => ({
      canonical_embedding: vectorToPgString(cluster.centroid),
      face_count: cluster.count,
      cover_photo_id: cluster.coverPhotoId,
    }));

    const { data: insertedClusters, error: insertClusterError } = await supabase
      .from("face_clusters")
      .insert(insertPayload)
      .select("id");

    if (insertClusterError) {
      return { error: insertClusterError.message };
    }

    createdClusters = (insertedClusters || []).length;

    for (let i = 0; i < pendingClusters.length; i += 1) {
      const dbClusterId = Number(insertedClusters?.[i]?.id);
      if (!Number.isFinite(dbClusterId)) continue;

      const ids = pendingClusters[i].assignedFaceIds;
      if (!ids.length) continue;

      const { error: assignError } = await supabase
        .from("face_embeddings")
        .update({ cluster_id: dbClusterId })
        .in("id", ids);

      if (assignError) {
        return { error: assignError.message };
      }
    }
  }

  for (const cluster of existingClusters) {
    if (cluster.assignedFaceIds.length > 0) {
      const { error: assignError } = await supabase
        .from("face_embeddings")
        .update({ cluster_id: cluster.id })
        .in("id", cluster.assignedFaceIds);

      if (assignError) {
        return { error: assignError.message };
      }
    }

    const { error: updateClusterError } = await supabase
      .from("face_clusters")
      .update({
        canonical_embedding: vectorToPgString(cluster.centroid),
        face_count: cluster.count,
        cover_photo_id: cluster.coverPhotoId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cluster.id);

    if (updateClusterError) {
      return { error: updateClusterError.message };
    }
  }

  return {
    ok: true,
    processed_faces: processedFaces,
    skipped_faces: skippedFaces,
    created_clusters: createdClusters,
    total_clusters: existingClusters.length + createdClusters,
    debug: { distanceLogs },
    method: "vector",
  };
}

async function runAwsClustering(params: {
  supabase: any;
  threshold: number;
  minQuality: number;
  reset: boolean;
}) {
  const { supabase, threshold, minQuality, reset } = params;

  let faceQuery = supabase
    .from("face_embeddings")
    .select("id, photo_id, aws_face_id, quality_score")
    .not("aws_face_id", "is", null)
    .order("id", { ascending: true });

  if (!reset) {
    faceQuery = faceQuery.is("cluster_id", null);
  }

  const { data, error } = await faceQuery;
  if (error) {
    return { error: error.message };
  }

  const faceRows: AwsFaceRow[] = (data || [])
    .map((row: any) => ({
      id: Number(row.id),
      photo_id: String(row.photo_id || ""),
      aws_face_id: String(row.aws_face_id || ""),
      quality_score: Number(row.quality_score || 0),
      embedding: parsePgVector(row.embedding),
    }))
    .filter((row: AwsFaceRow) => Number.isFinite(row.id) && !!row.photo_id && !!row.aws_face_id);

  const usableRows = faceRows.filter((row) => row.quality_score >= minQuality);
  const skippedFaces = faceRows.length - usableRows.length;

  if (usableRows.length === 0) {
    return {
      ok: true,
      processed_faces: 0,
      skipped_faces: skippedFaces,
      created_clusters: 0,
      total_clusters: 0,
      debug: { distanceLogs: [] },
      method: "aws",
    };
  }

  const indexByFaceId = new Map<string, number>();
  usableRows.forEach((row, index) => {
    indexByFaceId.set(row.aws_face_id, index);
  });

  const unionFind = new UnionFind(usableRows.length);
  const similarityThreshold = Math.max(1, Math.min(99, (1 - threshold) * 100));
  const distanceLogs: string[] = [];

  for (let i = 0; i < usableRows.length; i += 1) {
    const row = usableRows[i];

    try {
      const matches = await searchFacesByFaceId({
        awsFaceId: row.aws_face_id,
        similarityThreshold,
        maxFaces: 200,
      });

      if (i < 10) {
        distanceLogs.push(
          `AWS face ${row.id}: matches=${matches.length}, similarityThreshold=${similarityThreshold.toFixed(1)}`
        );
      }

      for (const match of matches) {
        const matchedIndex = indexByFaceId.get(match.awsFaceId);
        if (matchedIndex === undefined) continue;
        unionFind.union(i, matchedIndex);
      }
    } catch (error) {
      if (i < 10) {
        const message = error instanceof Error ? error.message : String(error);
        distanceLogs.push(`AWS face ${row.id}: search error=${message}`);
      }
    }
  }

  const membersByRoot = new Map<number, AwsFaceRow[]>();
  for (let i = 0; i < usableRows.length; i += 1) {
    const root = unionFind.find(i);
    const current = membersByRoot.get(root) || [];
    current.push(usableRows[i]);
    membersByRoot.set(root, current);
  }

  let createdClusters = 0;

  for (const members of membersByRoot.values()) {
    const faceCount = members.length;
    const coverPhotoIdRaw = Number(members[0]?.photo_id);
    const coverPhotoId = Number.isFinite(coverPhotoIdRaw) ? coverPhotoIdRaw : null;

    // pgvector columns require a valid dimensional vector. Use the first valid
    // member embedding when available, otherwise fallback to a 128-d zero vector.
    const centroidVector =
      members.find((member) => member.embedding.length === 128)?.embedding ||
      new Array<number>(128).fill(0);

    const { data: clusterRow, error: clusterInsertError } = await supabase
      .from("face_clusters")
      .insert({
        canonical_embedding: vectorToPgString(centroidVector),
        face_count: faceCount,
        cover_photo_id: coverPhotoId,
      })
      .select("id")
      .single();

    if (clusterInsertError || !clusterRow) {
      return { error: clusterInsertError?.message || "Failed to create cluster" };
    }

    const clusterId = Number(clusterRow.id);

    const { error: assignError } = await supabase
      .from("face_embeddings")
      .update({ cluster_id: clusterId })
      .in(
        "id",
        members.map((member) => member.id)
      );

    if (assignError) {
      return { error: assignError.message };
    }

    createdClusters += 1;
  }

  return {
    ok: true,
    processed_faces: usableRows.length,
    skipped_faces: skippedFaces,
    created_clusters: createdClusters,
    total_clusters: createdClusters,
    debug: { distanceLogs },
    method: "aws",
  };
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, Permission.CAN_UPLOAD_PHOTOS);
  if (user instanceof Response) return user;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await request.json().catch(() => ({}));

    const threshold = Number(body?.threshold ?? 0.35);
    const minQuality = Number(body?.min_quality ?? 0.45);
    const reset = body?.reset !== false;
    const requestedMethod = String(body?.method || "auto").toLowerCase();

    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      return Response.json({ error: "threshold must be between 0 and 1" }, { status: 400 });
    }

    if (!Number.isFinite(minQuality) || minQuality < 0 || minQuality > 1) {
      return Response.json({ error: "min_quality must be between 0 and 1" }, { status: 400 });
    }

    if (reset) {
      const { error: clearEmbeddingsError } = await supabase
        .from("face_embeddings")
        .update({ cluster_id: null })
        .not("id", "is", null);

      if (clearEmbeddingsError) {
        return Response.json({ error: clearEmbeddingsError.message }, { status: 500 });
      }

      const { error: clearClustersError } = await supabase.from("face_clusters").delete().gt("id", 0);

      if (clearClustersError) {
        return Response.json({ error: clearClustersError.message }, { status: 500 });
      }
    }

    let method: "vector" | "aws" = "vector";

    if (requestedMethod === "aws") {
      method = "aws";
    } else if (requestedMethod === "vector") {
      method = "vector";
    } else {
      const { count: awsCount } = await supabase
        .from("face_embeddings")
        .select("*", { count: "exact", head: true })
        .not("aws_face_id", "is", null);

      if ((awsCount || 0) > 0) {
        method = "aws";
      }
    }

    const result =
      method === "aws"
        ? await runAwsClustering({ supabase, threshold, minQuality, reset })
        : await runVectorClustering({ supabase, threshold, minQuality, reset });

    if ((result as { error?: string }).error) {
      return Response.json({ error: (result as { error: string }).error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      threshold,
      min_quality: minQuality,
      ...(result as Record<string, unknown>),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reclustering failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
