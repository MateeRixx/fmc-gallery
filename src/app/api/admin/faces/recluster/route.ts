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

      const { error: clearClustersError } = await supabase
        .from("face_clusters")
        .delete()
        .gt("id", 0);

      if (clearClustersError) {
        return Response.json({ error: clearClustersError.message }, { status: 500 });
      }
    }

    const { data: clusterRows, error: clusterRowsError } = await supabase
      .from("face_clusters")
      .select("id, canonical_embedding, face_count, cover_photo_id")
      .order("id", { ascending: true });

    if (clusterRowsError) {
      return Response.json({ error: clusterRowsError.message }, { status: 500 });
    }

    const existingClusters: ExistingCluster[] = (clusterRows || [])
      .map((row) => {
        const centroid = parsePgVector(row.canonical_embedding);
        return {
          id: Number(row.id),
          centroid,
          count: Number(row.face_count || 0),
          coverPhotoId: row.cover_photo_id ? String(row.cover_photo_id) : null,
          assignedFaceIds: [],
        };
      })
      .filter((cluster) => cluster.centroid.length === 128);

    let faceQuery = supabase
      .from("face_embeddings")
      .select("id, photo_id, embedding, quality_score")
      .order("id", { ascending: true });

    if (!reset) {
      faceQuery = faceQuery.is("cluster_id", null);
    }

    const { data: faceRows, error: faceRowsError } = await faceQuery;

    if (faceRowsError) {
      return Response.json({ error: faceRowsError.message }, { status: 500 });
    }

    const pendingClusters: PendingCluster[] = [];
    let processedFaces = 0;
    let skippedFaces = 0;

    // Track distances for debugging
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

      // Log first 10 faces for debugging
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

    console.log("Recluster Debug Logs:", distanceLogs);

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
        return Response.json({ error: insertClusterError.message }, { status: 500 });
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
          return Response.json({ error: assignError.message }, { status: 500 });
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
          return Response.json({ error: assignError.message }, { status: 500 });
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
        return Response.json({ error: updateClusterError.message }, { status: 500 });
      }
    }

    const totalClusters = existingClusters.length + createdClusters;

    return Response.json({
      ok: true,
      threshold,
      min_quality: minQuality,
      processed_faces: processedFaces,
      skipped_faces: skippedFaces,
      created_clusters: createdClusters,
      total_clusters: totalClusters,
      debug: { distanceLogs },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reclustering failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
