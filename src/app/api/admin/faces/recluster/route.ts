import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermissionCompat } from "@/lib/auth-utils";
import { Permission } from "@/types";
import {
  cosineDistance,
  mergeCentroid,
  parsePgVector,
  vectorToPgString,
} from "@/lib/faceClusters";
import { searchFacesByFaceId } from "@/lib/awsRekognition";
import { revalidateAllClusters } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

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
  cluster_id: number | null;
};

type ClusterableAwsFace = {
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

// ============================================================================
// PART 1: Global Graph-Based Clustering (replaces broken pairwise approach)
// ============================================================================

async function runAwsClusteringGlobal(params: {
  supabase: any;
  threshold: number;
  minQuality: number;
  reset: boolean;
  onProgress?: (status: string) => void;
}) {
  const { supabase, threshold, minQuality, reset, onProgress } = params;

  let faceQuery = supabase
    .from("face_embeddings")
    .select("id, photo_id, aws_face_id, quality_score, embedding, cluster_id")
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
      cluster_id: row.cluster_id ? Number(row.cluster_id) : null,
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

  onProgress?.(`Building similarity graph for ${usableRows.length} faces...`);

  const indexByFaceId = new Map<string, number>();
  usableRows.forEach((row, index) => {
    indexByFaceId.set(row.aws_face_id, index);
  });

  const similarityThreshold = Math.max(1, Math.min(99, (1 - threshold) * 100));
  const distanceLogs: string[] = [];

  // PASS 1: Build complete edge set (collect ALL matches first)
  const edges: [number, number][] = [];
  let searchErrors = 0;

  for (let i = 0; i < usableRows.length; i += 1) {
    const row = usableRows[i];

    if (i % 10 === 0) {
      onProgress?.(`Pass 1: Searching ${i + 1}/${usableRows.length} faces for matches...`);
    }

    try {
      const matches = await searchFacesByFaceId({
        awsFaceId: row.aws_face_id,
        similarityThreshold,
        maxFaces: 200,
      });

      if (i < 10) {
        distanceLogs.push(
          `AWS face ${row.id}: found ${matches.length} matches, threshold=${similarityThreshold.toFixed(1)}%`
        );
      }

      for (const match of matches) {
        const matchedIndex = indexByFaceId.get(match.awsFaceId);
        if (matchedIndex === undefined || matchedIndex === i) continue;

        // Store edge (deduplication happens naturally in Union-Find)
        edges.push([i, matchedIndex]);
      }
    } catch (error) {
      searchErrors += 1;
      if (i < 10) {
        const message = error instanceof Error ? error.message : String(error);
        distanceLogs.push(`AWS face ${row.id}: search error=${message}`);
      }
      // Continue processing other faces even if one fails
      console.error(`Failed to search face ${row.id}:`, error);
    }
  }

  onProgress?.(`Pass 1 complete: Found ${edges.length} edges with ${searchErrors} errors`);

  // PASS 2: Apply Union-Find to complete graph (ensures transitivity)
  onProgress?.(`Pass 2: Applying Union-Find to ${edges.length} edges...`);

  const unionFind = new UnionFind(usableRows.length);

  for (const [a, b] of edges) {
    unionFind.union(a, b);
  }

  // Group faces by their root (cluster representative)
  const membersByRoot = new Map<number, AwsFaceRow[]>();
  for (let i = 0; i < usableRows.length; i += 1) {
    const root = unionFind.find(i);
    const current = membersByRoot.get(root) || [];
    current.push(usableRows[i]);
    membersByRoot.set(root, current);
  }

  onProgress?.(`Pass 2 complete: Created ${membersByRoot.size} clusters`);

  // Write clusters to database
  let createdClusters = 0;
  const clustersNeedingAudit: number[] = [];
  const createdClusterIds: number[] = [];

  for (const [root, members] of Array.from(membersByRoot.entries())) {
    const faceCount = members.length;
    // photo_id is a UUID string, not a number
    const coverPhotoId = members[0]?.photo_id || null;
    const coverFaceId = members[0]?.id || null; // Store the face ID for cropped thumbnail

    // Use first valid embedding or zero vector fallback
    const centroidVector =
      members.find((member) => member.embedding.length === 128)?.embedding ||
      new Array<number>(128).fill(0);

    const { data: clusterRow, error: clusterInsertError } = await supabase
      .from("face_clusters")
      .insert({
        canonical_embedding: vectorToPgString(centroidVector),
        face_count: faceCount,
        cover_photo_id: coverPhotoId,
        cover_face_id: coverFaceId,
        member_count: faceCount,
      })
      .select("id")
      .single();

    if (clusterInsertError || !clusterRow) {
      return { error: clusterInsertError?.message || "Failed to create cluster" };
    }

    const clusterId = Number(clusterRow.id);
    createdClusterIds.push(clusterId);

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

    // Flag clusters with many members for quality audit
    if (faceCount > 5) {
      clustersNeedingAudit.push(clusterId);
    }
  }

  // PASS 3: Merge duplicate clusters (same person in multiple clusters)
  let mergeResult: {
    merged_clusters: number;
    skipped?: boolean;
    reason?: string;
  } = { merged_clusters: 0 };

  if (createdClusterIds.length > 80) {
    const skipReason = `Skipped duplicate merge for ${createdClusterIds.length} clusters to keep reclustering stable`;
    mergeResult = {
      merged_clusters: 0,
      skipped: true,
      reason: skipReason,
    };
    onProgress?.(skipReason);
  } else {
    onProgress?.(`Pass 3: Checking for duplicate clusters...`);
    try {
      mergeResult = await mergeDuplicateClusters({
        supabase,
        clusterIds: createdClusterIds,
        threshold,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[PASS 3] Duplicate merge failed:", error);
      mergeResult = {
        merged_clusters: 0,
        skipped: true,
        reason: `Duplicate merge skipped after error: ${message}`,
      };
    }
  }

  return {
    ok: true,
    processed_faces: usableRows.length,
    skipped_faces: skippedFaces,
    created_clusters: createdClusters,
    total_clusters: createdClusters - (mergeResult.merged_clusters || 0),
    search_errors: searchErrors,
    clusters_needing_audit: clustersNeedingAudit,
    merged_duplicates: mergeResult.merged_clusters || 0,
    duplicate_merge_skipped: Boolean(mergeResult.skipped),
    duplicate_merge_reason: mergeResult.reason || null,
    debug: { distanceLogs, edges: edges.length },
    method: "aws-global",
  };
}

// ============================================================================
// Merge Duplicate Clusters (Post-Processing)
// ============================================================================

async function mergeDuplicateClusters(params: {
  supabase: any;
  clusterIds: number[];
  threshold: number;
}) {
  const { supabase, clusterIds, threshold } = params;

  if (clusterIds.length < 2) {
    return { merged_clusters: 0 };
  }

  console.log(`[PASS 3] Checking ${clusterIds.length} clusters for duplicates...`);

  // Get multiple representative faces from each cluster (top 3 quality faces per cluster)
  const { data: representativeFaces } = await supabase
    .from("face_embeddings")
    .select("id, cluster_id, aws_face_id, quality_score, embedding")
    .in("cluster_id", clusterIds)
    .not("aws_face_id", "is", null)
    .order("quality_score", { ascending: false });

  if (!representativeFaces || representativeFaces.length < 2) {
    console.log("[PASS 3] No representative faces found");
    return { merged_clusters: 0 };
  }

  // Get top 3 faces per cluster for better duplicate detection
  const facesByCluster = new Map<number, Array<{ id: number; aws_face_id: string; embedding: number[] }>>();
  for (const face of representativeFaces) {
    const clusterId = Number(face.cluster_id);
    if (!facesByCluster.has(clusterId)) {
      facesByCluster.set(clusterId, []);
    }
    const clusterFaces = facesByCluster.get(clusterId)!;
    if (clusterFaces.length < 3) { // Use top 3 faces per cluster
      clusterFaces.push({
        id: Number(face.id),
        aws_face_id: String(face.aws_face_id),
        embedding: parsePgVector(face.embedding),
      });
    }
  }

  // Use more lenient threshold for duplicate detection (15% more lenient than clustering threshold)
  const duplicateThreshold = Math.max(threshold - 0.15, 0.1);
  const similarityThreshold = Math.max(1, Math.min(99, (1 - duplicateThreshold) * 100));

  console.log(`[PASS 3] Using duplicate threshold: ${duplicateThreshold}, AWS similarity: ${similarityThreshold}%`);

  const clusterUnion = new UnionFind(clusterIds.length);
  const clusterIndexMap = new Map<number, number>();
  clusterIds.forEach((id, index) => clusterIndexMap.set(id, index));

  let totalMatches = 0;

  // Check each cluster against others using multiple methods
  for (let i = 0; i < clusterIds.length; i++) {
    const clusterIdA = clusterIds[i];
    const facesA = facesByCluster.get(clusterIdA);
    if (!facesA || facesA.length === 0) continue;

    for (let j = i + 1; j < clusterIds.length; j++) {
      const clusterIdB = clusterIds[j];
      const facesB = facesByCluster.get(clusterIdB);
      if (!facesB || facesB.length === 0) continue;

      let foundMatch = false;

      // Method 1: AWS Face Search (more accurate but can miss some matches)
      for (const faceA of facesA) {
        if (foundMatch) break;

        try {
          const matches = await searchFacesByFaceId({
            awsFaceId: faceA.aws_face_id,
            similarityThreshold,
            maxFaces: 50,
          });

          const matchedFaceIds = new Set(matches.map((m: { awsFaceId: string; similarity: number }) => m.awsFaceId));

          for (const faceB of facesB) {
            if (matchedFaceIds.has(faceB.aws_face_id)) {
              console.log(`[PASS 3] AWS match found: cluster ${clusterIdA} <-> ${clusterIdB}`);
              const indexA = clusterIndexMap.get(clusterIdA)!;
              const indexB = clusterIndexMap.get(clusterIdB)!;
              clusterUnion.union(indexA, indexB);
              foundMatch = true;
              totalMatches++;
              break;
            }
          }
        } catch (error) {
          console.error(`[PASS 3] AWS search failed for face ${faceA.id}:`, error);
        }
      }

      // Method 2: Direct embedding similarity (fallback for AWS search failures)
      if (!foundMatch) {
        for (const faceA of facesA) {
          if (foundMatch) break;

          for (const faceB of facesB) {
            if (faceA.embedding.length === 128 && faceB.embedding.length === 128) {
              const distance = cosineDistance(faceA.embedding, faceB.embedding);
              if (distance <= duplicateThreshold) {
                console.log(`[PASS 3] Embedding match found: cluster ${clusterIdA} <-> ${clusterIdB} (distance: ${distance.toFixed(4)})`);
                const indexA = clusterIndexMap.get(clusterIdA)!;
                const indexB = clusterIndexMap.get(clusterIdB)!;
                clusterUnion.union(indexA, indexB);
                foundMatch = true;
                totalMatches++;
                break;
              }
            }
          }
        }
      }
    }
  }

  console.log(`[PASS 3] Found ${totalMatches} cross-cluster matches`);

  // Group clusters that should be merged
  const clusterGroupsByRoot = new Map<number, number[]>();
  for (let i = 0; i < clusterIds.length; i++) {
    const root = clusterUnion.find(i);
    if (!clusterGroupsByRoot.has(root)) {
      clusterGroupsByRoot.set(root, []);
    }
    clusterGroupsByRoot.get(root)!.push(clusterIds[i]);
  }

  let mergedCount = 0;
  console.log(`[PASS 3] Found ${clusterGroupsByRoot.size} cluster groups`);

  // Merge each group
  for (const clusterGroup of clusterGroupsByRoot.values()) {
    if (clusterGroup.length < 2) continue; // No merge needed

    console.log(`[PASS 3] Merging cluster group: [${clusterGroup.join(', ')}]`);

    // Get cluster info to determine which to keep
    const { data: clusterInfo } = await supabase
      .from("face_clusters")
      .select("id, member_count")
      .in("id", clusterGroup);

    if (!clusterInfo || clusterInfo.length < 2) continue;

    // Keep the largest cluster, merge others into it
    const sorted = clusterInfo.sort((a: any, b: any) => (b.member_count || 0) - (a.member_count || 0));
    const keepClusterId = sorted[0].id;
    const toMerge = sorted.slice(1);

    let totalMovedFaces = 0;
    for (const clusterToMerge of toMerge) {
      // Move all faces to the kept cluster
      const { error: moveError } = await supabase
        .from("face_embeddings")
        .update({ cluster_id: keepClusterId })
        .eq("cluster_id", clusterToMerge.id);

      if (moveError) {
        console.error(`[PASS 3] Failed to move faces from cluster ${clusterToMerge.id}:`, moveError);
        continue;
      }

      totalMovedFaces += clusterToMerge.member_count || 0;

      // Delete merged cluster
      await supabase
        .from("face_clusters")
        .delete()
        .eq("id", clusterToMerge.id);

      console.log(`[PASS 3] Merged duplicate cluster ${clusterToMerge.id} -> ${keepClusterId} (${clusterToMerge.member_count} faces)`);
      mergedCount++;
    }

    // Update member count of kept cluster
    if (totalMovedFaces > 0) {
      const newMemberCount = sorted[0].member_count + totalMovedFaces;
      await supabase
        .from("face_clusters")
        .update({
          member_count: newMemberCount,
          face_count: newMemberCount,
        })
        .eq("id", keepClusterId);
    }
  }

  console.log(`[PASS 3] Successfully merged ${mergedCount} duplicate clusters`);
  return { merged_clusters: mergedCount };
}

async function detectAndMergeOverlappingClusters(params: {
  supabase: any;
  clusterIds: number[];
  threshold: number;
}) {
  const { supabase, clusterIds, threshold } = params;

  if (clusterIds.length < 2) return;

  // Get sample faces from each cluster
  const { data: clusterFaces } = await supabase
    .from("face_embeddings")
    .select("id, cluster_id, aws_face_id")
    .in("cluster_id", clusterIds)
    .not("aws_face_id", "is", null)
    .limit(200);

  if (!clusterFaces || clusterFaces.length < 2) return;

  const facesByCluster = new Map<number, string[]>();
  for (const face of clusterFaces) {
    const clusterId = Number(face.cluster_id);
    if (!facesByCluster.has(clusterId)) {
      facesByCluster.set(clusterId, []);
    }
    facesByCluster.get(clusterId)!.push(face.aws_face_id);
  }

  const similarityThreshold = Math.max(1, Math.min(99, (1 - threshold) * 100));
  const clusterPairsToMerge: [number, number][] = [];

  // Check each pair of clusters
  const clusterArray = Array.from(facesByCluster.keys());
  for (let i = 0; i < clusterArray.length; i++) {
    for (let j = i + 1; j < clusterArray.length; j++) {
      const clusterA = clusterArray[i];
      const clusterB = clusterArray[j];
      const facesA = facesByCluster.get(clusterA)!;
      const facesB = facesByCluster.get(clusterB)!;

      // Sample one face from cluster A and check against cluster B
      try {
        const matches = await searchFacesByFaceId({
          awsFaceId: facesA[0],
          similarityThreshold,
          maxFaces: 50,
        });

        const matchesInB = matches.filter((m: { awsFaceId: string; similarity: number }) => facesB.includes(m.awsFaceId));

        // If significant overlap (>20% of smaller cluster), merge
        const overlapRatio = matchesInB.length / Math.min(facesA.length, facesB.length);
        if (overlapRatio > 0.2) {
          clusterPairsToMerge.push([clusterA, clusterB]);
        }
      } catch (error) {
        console.error(`Failed to check overlap between clusters ${clusterA} and ${clusterB}:`, error);
      }
    }
  }

  // Merge clusters
  for (const [clusterA, clusterB] of clusterPairsToMerge) {
    const { data: clusterInfo } = await supabase
      .from("face_clusters")
      .select("id, member_count")
      .in("id", [clusterA, clusterB]);

    if (!clusterInfo || clusterInfo.length !== 2) continue;

    const [larger, smaller] =
      clusterInfo[0].member_count >= clusterInfo[1].member_count
        ? [clusterInfo[0], clusterInfo[1]]
        : [clusterInfo[1], clusterInfo[0]];

    // Move all faces from smaller to larger cluster
    await supabase
      .from("face_embeddings")
      .update({ cluster_id: larger.id })
      .eq("cluster_id", smaller.id);

    // Update member count
    await supabase
      .from("face_clusters")
      .update({
        member_count: larger.member_count + smaller.member_count,
        face_count: larger.member_count + smaller.member_count,
      })
      .eq("id", larger.id);

    // Delete smaller cluster
    await supabase.from("face_clusters").delete().eq("id", smaller.id);

    console.log(`Merged cluster ${smaller.id} into cluster ${larger.id}`);
  }
}

async function createClustersForUnmatchedFaces(params: {
  supabase: any;
  faceIds: number[];
  threshold: number;
  minQuality: number;
  onProgress?: (status: string) => void;
}) {
  const { supabase, faceIds, threshold, minQuality, onProgress } = params;

  if (faceIds.length === 0) {
    return {
      ok: true,
      created_clusters: 0,
      clustered_faces: 0,
      remaining_unclustered_faces: 0,
    };
  }

  const { data, error } = await supabase
    .from("face_embeddings")
    .select("id, photo_id, aws_face_id, quality_score, embedding")
    .in("id", faceIds)
    .not("aws_face_id", "is", null);

  if (error) {
    return { error: error.message };
  }

  const usableFaces: ClusterableAwsFace[] = (data || [])
    .map((row: any) => ({
      id: Number(row.id),
      photo_id: String(row.photo_id || ""),
      aws_face_id: String(row.aws_face_id || ""),
      quality_score: Number(row.quality_score || 0),
      embedding: parsePgVector(row.embedding),
    }))
    .filter(
      (row: ClusterableAwsFace) =>
        Number.isFinite(row.id) &&
        !!row.photo_id &&
        !!row.aws_face_id &&
        row.quality_score >= minQuality
    );

  if (usableFaces.length === 0) {
    return {
      ok: true,
      created_clusters: 0,
      clustered_faces: 0,
      remaining_unclustered_faces: faceIds.length,
    };
  }

  onProgress?.(`Creating clusters for ${usableFaces.length} unmatched face(s)...`);

  const indexByFaceId = new Map<string, number>();
  usableFaces.forEach((row, index) => {
    indexByFaceId.set(row.aws_face_id, index);
  });

  const similarityThreshold = Math.max(1, Math.min(99, (1 - threshold) * 100));
  const edges: [number, number][] = [];

  for (let i = 0; i < usableFaces.length; i += 1) {
    if (i % 10 === 0) {
      onProgress?.(`Building new clusters ${i + 1}/${usableFaces.length}...`);
    }

    try {
      const matches = await searchFacesByFaceId({
        awsFaceId: usableFaces[i].aws_face_id,
        similarityThreshold,
        maxFaces: 50,
      });

      for (const match of matches) {
        const matchedIndex = indexByFaceId.get(match.awsFaceId);
        if (matchedIndex === undefined || matchedIndex === i) continue;
        edges.push([i, matchedIndex]);
      }
    } catch (error) {
      console.error(`Failed to build unmatched cluster for face ${usableFaces[i].id}:`, error);
    }
  }

  const unionFind = new UnionFind(usableFaces.length);
  for (const [a, b] of edges) {
    unionFind.union(a, b);
  }

  const membersByRoot = new Map<number, ClusterableAwsFace[]>();
  for (let i = 0; i < usableFaces.length; i += 1) {
    const root = unionFind.find(i);
    const current = membersByRoot.get(root) || [];
    current.push(usableFaces[i]);
    membersByRoot.set(root, current);
  }

  let createdClusters = 0;
  let clusteredFaces = 0;

  for (const members of Array.from(membersByRoot.values())) {
    const centroidVector =
      members.find((member) => member.embedding.length === 128)?.embedding ||
      new Array<number>(128).fill(0);
    const coverPhotoId = members[0]?.photo_id || null;
    const coverFaceId = members[0]?.id || null;

    const { data: clusterRow, error: clusterInsertError } = await supabase
      .from("face_clusters")
      .insert({
        canonical_embedding: vectorToPgString(centroidVector),
        face_count: members.length,
        cover_photo_id: coverPhotoId,
        cover_face_id: coverFaceId,
        member_count: members.length,
      })
      .select("id")
      .single();

    if (clusterInsertError || !clusterRow) {
      return { error: clusterInsertError?.message || "Failed to create unmatched cluster" };
    }

    const clusterId = Number(clusterRow.id);
    const memberIds = members.map((member) => member.id);
    const { error: assignError } = await supabase
      .from("face_embeddings")
      .update({ cluster_id: clusterId })
      .in("id", memberIds);

    if (assignError) {
      return { error: assignError.message };
    }

    createdClusters += 1;
    clusteredFaces += memberIds.length;
  }

  return {
    ok: true,
    created_clusters: createdClusters,
    clustered_faces: clusteredFaces,
    remaining_unclustered_faces: Math.max(faceIds.length - clusteredFaces, 0),
  };
}

// ============================================================================
// PART 2: Incremental Merge (for new photo uploads)
// ============================================================================

export async function mergeNewFacesIntoExistingClusters(params: {
  supabase: any;
  newFaceIds: number[];
  threshold: number;
  minQuality: number;
  onProgress?: (status: string) => void;
}) {
  const { supabase, newFaceIds, threshold, minQuality, onProgress } = params;

  if (newFaceIds.length === 0) {
    return { ok: true, merged_faces: 0, new_clusters_needed: 0 };
  }

  onProgress?.(`Merging ${newFaceIds.length} new faces into existing clusters...`);

  // Fetch new faces with AWS face IDs
  const { data: newFaces, error: fetchError } = await supabase
    .from("face_embeddings")
    .select("id, photo_id, aws_face_id, quality_score, embedding")
    .in("id", newFaceIds)
    .not("aws_face_id", "is", null);

  if (fetchError) {
    return { error: fetchError.message };
  }

  const usableNewFaces = (newFaces || [])
    .map((row: any) => ({
      id: Number(row.id),
      photo_id: String(row.photo_id || ""),
      aws_face_id: String(row.aws_face_id || ""),
      quality_score: Number(row.quality_score || 0),
      embedding: parsePgVector(row.embedding),
    }))
    .filter((row: any) => row.quality_score >= minQuality && row.aws_face_id);

  const similarityThreshold = Math.max(1, Math.min(99, (1 - threshold) * 100));
  let mergedCount = 0;
  const unmatchedFaceIds: number[] = [];
  const clusterMatchCounts = new Map<number, number[]>(); // clusterId -> matching face IDs

  for (let i = 0; i < usableNewFaces.length; i++) {
    const newFace = usableNewFaces[i];

    if (i % 5 === 0) {
      onProgress?.(`Merging face ${i + 1}/${usableNewFaces.length}...`);
    }

    try {
      const matches = await searchFacesByFaceId({
        awsFaceId: newFace.aws_face_id,
        similarityThreshold,
        maxFaces: 50,
      });

      if (matches.length === 0) {
        unmatchedFaceIds.push(newFace.id);
        continue;
      }

      // Find which existing clusters these matches belong to
      const matchedAwsFaceIds = matches.map((m: { awsFaceId: string; similarity: number }) => m.awsFaceId);

      const { data: matchedFaces, error: matchError } = await supabase
        .from("face_embeddings")
        .select("id, cluster_id, aws_face_id")
        .in("aws_face_id", matchedAwsFaceIds)
        .not("cluster_id", "is", null);

      if (matchError || !matchedFaces || matchedFaces.length === 0) {
        unmatchedFaceIds.push(newFace.id);
        continue;
      }

      // Count matches per cluster to find best fit
      const clusterVotes = new Map<number, number>();
      for (const match of matchedFaces) {
        const clusterId = Number(match.cluster_id);
        if (Number.isFinite(clusterId)) {
          clusterVotes.set(clusterId, (clusterVotes.get(clusterId) || 0) + 1);
        }
      }

      if (clusterVotes.size === 0) {
        unmatchedFaceIds.push(newFace.id);
        continue;
      }

      // Pick cluster with most matches
      let bestClusterId = -1;
      let maxVotes = 0;
      for (const [clusterId, votes] of Array.from(clusterVotes.entries())) {
        if (votes > maxVotes) {
          maxVotes = votes;
          bestClusterId = clusterId;
        }
      }

      // Assign new face to best cluster
      const { error: assignError } = await supabase
        .from("face_embeddings")
        .update({ cluster_id: bestClusterId })
        .eq("id", newFace.id);

      if (assignError) {
        console.error(`Failed to assign face ${newFace.id} to cluster ${bestClusterId}:`, assignError);
        unmatchedFaceIds.push(newFace.id);
        continue;
      }

      // Update cluster member_count
      const { data: currentCluster } = await supabase
        .from("face_clusters")
        .select("member_count, face_count")
        .eq("id", bestClusterId)
        .maybeSingle();

      const nextMemberCount = Number(currentCluster?.member_count || currentCluster?.face_count || 0) + 1;

      await supabase
        .from("face_clusters")
        .update({
          member_count: nextMemberCount,
          face_count: nextMemberCount,
        })
        .eq("id", bestClusterId);

      mergedCount += 1;

      // Track which clusters gained new faces (for potential merge detection)
      if (!clusterMatchCounts.has(bestClusterId)) {
        clusterMatchCounts.set(bestClusterId, []);
      }
      clusterMatchCounts.get(bestClusterId)!.push(newFace.id);

    } catch (error) {
      console.error(`Failed to merge face ${newFace.id}:`, error);
      unmatchedFaceIds.push(newFace.id);
    }
  }

  // Check if we should merge any existing clusters
  // (If two clusters both received many new faces that match each other)
  if (clusterMatchCounts.size >= 2) {
    onProgress?.("Checking if existing clusters should merge...");
    await detectAndMergeOverlappingClusters({
      supabase,
      clusterIds: Array.from(clusterMatchCounts.keys()),
      threshold,
    });
  }

  const clusterCreationResult = await createClustersForUnmatchedFaces({
    supabase,
    faceIds: unmatchedFaceIds,
    threshold,
    minQuality,
    onProgress,
  });

  if ((clusterCreationResult as { error?: string }).error) {
    return { error: (clusterCreationResult as { error: string }).error };
  }

  return {
    ok: true,
    merged_faces: mergedCount,
    unmatched_faces: (clusterCreationResult as { remaining_unclustered_faces: number }).remaining_unclustered_faces,
    clusters_updated: clusterMatchCounts.size,
    new_clusters_created: (clusterCreationResult as { created_clusters: number }).created_clusters,
    newly_clustered_faces: (clusterCreationResult as { clustered_faces: number }).clustered_faces,
  };
}

// ============================================================================
// PART 3: Cluster Quality Auditing
// ============================================================================

export async function auditClusterQuality(params: {
  supabase: any;
  clusterId: number;
  threshold: number;
  autoSplit?: boolean;
}) {
  const { supabase, clusterId, threshold, autoSplit = false } = params;

  // Fetch all faces in this cluster
  const { data: clusterFaces, error: fetchError } = await supabase
    .from("face_embeddings")
    .select("id, photo_id, aws_face_id, quality_score, embedding")
    .eq("cluster_id", clusterId)
    .not("aws_face_id", "is", null);

  if (fetchError || !clusterFaces || clusterFaces.length < 2) {
    return { error: fetchError?.message || "Cluster too small to audit" };
  }

  const awsFaceIds = clusterFaces.map((f: any) => f.aws_face_id);
  const strictThreshold = Math.max(1, Math.min(99, (1 - (threshold - 0.1)) * 100));

  let facesWithIntraClusterMatches = 0;

  // For each face, check how many OTHER faces in the same cluster it matches
  for (let i = 0; i < clusterFaces.length; i++) {
    const face = clusterFaces[i];

    try {
      const matches = await searchFacesByFaceId({
        awsFaceId: face.aws_face_id,
        similarityThreshold: strictThreshold,
        maxFaces: 50,
      });

      const matchesInsideCluster = matches.filter((m: { awsFaceId: string; similarity: number }) =>
        awsFaceIds.includes(m.awsFaceId) && m.awsFaceId !== face.aws_face_id
      );

      if (matchesInsideCluster.length > 0) {
        facesWithIntraClusterMatches += 1;
      }
    } catch (error) {
      console.error(`Failed to audit face ${face.id}:`, error);
    }
  }

  const qualityScore = facesWithIntraClusterMatches / clusterFaces.length;
  const needsReview = qualityScore < 0.5;

  // Update cluster with audit results
  await supabase
    .from("face_clusters")
    .update({
      needs_review: needsReview,
      last_audited_at: new Date().toISOString(),
    })
    .eq("id", clusterId);

  // Auto-split if requested and quality is poor
  if (autoSplit && needsReview && clusterFaces.length > 3) {
    const splitResult = await splitCluster({
      supabase,
      clusterId,
      faces: clusterFaces,
      threshold: threshold - 0.1, // Stricter threshold for splitting
    });

    return {
      ok: true,
      quality_score: qualityScore,
      needs_review: needsReview,
      split: true,
      new_clusters: splitResult.newClusters || 0,
    };
  }

  return {
    ok: true,
    quality_score: qualityScore,
    needs_review: needsReview,
    split: false,
  };
}

async function splitCluster(params: {
  supabase: any;
  clusterId: number;
  faces: any[];
  threshold: number;
}) {
  const { supabase, clusterId, faces, threshold } = params;

  const usableFaces = faces
    .map((f: any) => ({
      id: Number(f.id),
      photo_id: String(f.photo_id || ""),
      aws_face_id: String(f.aws_face_id),
      embedding: parsePgVector(f.embedding),
    }))
    .filter((f) => f.aws_face_id && f.embedding.length === 128);

  if (usableFaces.length < 2) {
    return { newClusters: 0 };
  }

  const indexByFaceId = new Map<string, number>();
  usableFaces.forEach((face, index) => {
    indexByFaceId.set(face.aws_face_id, index);
  });

  const similarityThreshold = Math.max(1, Math.min(99, (1 - threshold) * 100));
  const edges: [number, number][] = [];

  // Build edge set within this cluster using stricter threshold
  for (let i = 0; i < usableFaces.length; i++) {
    try {
      const matches = await searchFacesByFaceId({
        awsFaceId: usableFaces[i].aws_face_id,
        similarityThreshold,
        maxFaces: 50,
      });

      for (const match of matches) {
        const matchedIndex = indexByFaceId.get(match.awsFaceId);
        if (matchedIndex !== undefined && matchedIndex !== i) {
          edges.push([i, matchedIndex]);
        }
      }
    } catch (error) {
      console.error(`Failed to search during split for face ${usableFaces[i].id}:`, error);
    }
  }

  // Apply Union-Find to find natural sub-clusters
  const unionFind = new UnionFind(usableFaces.length);
  for (const [a, b] of edges) {
    unionFind.union(a, b);
  }

  const membersByRoot = new Map<number, any[]>();
  for (let i = 0; i < usableFaces.length; i++) {
    const root = unionFind.find(i);
    if (!membersByRoot.has(root)) {
      membersByRoot.set(root, []);
    }
    membersByRoot.get(root)!.push(usableFaces[i]);
  }

  // If we found multiple sub-clusters, create them
  if (membersByRoot.size > 1) {
    for (const members of Array.from(membersByRoot.values())) {
      const centroidVector = members[0]?.embedding || new Array(128).fill(0);
      const coverPhotoId = members[0]?.photo_id || null;

      const { data: newCluster } = await supabase
        .from("face_clusters")
        .insert({
          canonical_embedding: vectorToPgString(centroidVector),
          face_count: members.length,
          cover_photo_id: coverPhotoId,
          member_count: members.length,
        })
        .select("id")
        .single();

      if (newCluster) {
        await supabase
          .from("face_embeddings")
          .update({ cluster_id: newCluster.id })
          .in(
            "id",
            members.map((m) => m.id)
          );
      }
    }

    // Delete the original cluster
    await supabase.from("face_clusters").delete().eq("id", clusterId);

    return { newClusters: membersByRoot.size };
  }

  return { newClusters: 0 };
}

// ============================================================================
// VECTOR MODE (Legacy - unchanged)
// ============================================================================

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
        `Face ${faceId}: bestDistance=${bestDistance.toFixed(4)}, threshold=${threshold}`
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
      member_count: cluster.count,
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
        member_count: cluster.count,
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

// ============================================================================
// MAIN API ROUTE
// ============================================================================

export async function POST(request: NextRequest) {
  const user = await requirePermissionCompat(request, Permission.CAN_UPLOAD_PHOTOS);
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
    const mode = String(body?.mode || "full").toLowerCase(); // "full" or "incremental"
    const newFaceIds = Array.isArray(body?.new_face_ids) ? body.new_face_ids : [];

    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      return Response.json({ error: "threshold must be between 0 and 1" }, { status: 400 });
    }

    if (!Number.isFinite(minQuality) || minQuality < 0 || minQuality > 1) {
      return Response.json({ error: "min_quality must be between 0 and 1" }, { status: 400 });
    }

    // INCREMENTAL MODE (for upload triggers)
    if (mode === "incremental" && newFaceIds.length > 0) {
      const result = await mergeNewFacesIntoExistingClusters({
        supabase,
        newFaceIds,
        threshold,
        minQuality,
        onProgress: (status) => console.log(status),
      });

      return Response.json({
        ok: true,
        mode: "incremental",
        threshold,
        min_quality: minQuality,
        ...result,
      });
    }

    // FULL RECLUSTER MODE
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
        ? await runAwsClusteringGlobal({
            supabase,
            threshold,
            minQuality,
            reset,
            onProgress: (status) => console.log(status),
          })
        : await runVectorClustering({ supabase, threshold, minQuality, reset });

    if ((result as { error?: string }).error) {
      return Response.json({ error: (result as { error: string }).error }, { status: 500 });
    }

    // Run quality audits on large clusters if requested
    if (body?.audit_quality && (result as any).clusters_needing_audit) {
      const clustersToAudit = (result as any).clusters_needing_audit || [];

      for (const clusterId of clustersToAudit.slice(0, 5)) {
        // Audit up to 5 largest clusters
        await auditClusterQuality({
          supabase,
          clusterId,
          threshold,
          autoSplit: body?.auto_split === true,
        });
      }
    }

    // Revalidate all cluster pages after reclustering completes
    await revalidateAllClusters();

    return Response.json({
      ok: true,
      mode: "full",
      threshold,
      min_quality: minQuality,
      ...(result as Record<string, unknown>),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reclustering failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
