import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { ClusterQuerySchema, validationErrorResponse } from "@/lib/validate";
import { z } from "zod";

async function handler(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    let validated;
    try {
      validated = ClusterQuerySchema.parse({
        event_id: searchParams.get("event_id") || undefined,
        limit: searchParams.get("limit") || undefined,
        offset: searchParams.get("offset") || undefined,
        sort: searchParams.get("sort") || undefined,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(error);
      }
      throw error;
    }

    const { event_id: eventId, limit, offset, sort } = validated;

    if (eventId) {
      const { data: eventFaces, error: eventFacesError } = await supabase
        .from("face_embeddings")
        .select("cluster_id, photo_id")
        .eq("event_id", eventId)
        .not("cluster_id", "is", null);

      if (eventFacesError) {
        return Response.json({ error: eventFacesError.message }, { status: 500 });
      }

      const byCluster = new Map<number, { photoIds: Set<string>; faceCount: number }>();
      for (const row of eventFaces || []) {
        const clusterId = Number(row.cluster_id);
        if (!Number.isFinite(clusterId)) continue;

        const current = byCluster.get(clusterId) || { photoIds: new Set<string>(), faceCount: 0 };
        current.faceCount += 1;
        if (row.photo_id) current.photoIds.add(String(row.photo_id));
        byCluster.set(clusterId, current);
      }

      const clusterIds = Array.from(byCluster.keys());
      if (!clusterIds.length) {
        return Response.json({ ok: true, people: [], pagination: { limit, offset, returned: 0 } });
      }

      const sortedClusterIds = clusterIds.sort((a, b) => {
        const aCount = byCluster.get(a)?.faceCount || 0;
        const bCount = byCluster.get(b)?.faceCount || 0;
        return bCount - aCount;
      });

      // Apply offset-based pagination
      const effectiveClusterIds = sortedClusterIds.slice(offset, offset + limit);
      const { data: clusterRows, error: clusterError } = await supabase
        .from("face_clusters")
        .select("id, face_count, cover_photo_id, cover_face_id, updated_at")
        .in("id", effectiveClusterIds);

      if (clusterError) {
        return Response.json({ error: clusterError.message }, { status: 500 });
      }

      const coverIds = Array.from(
        new Set(
          effectiveClusterIds
            .flatMap((clusterId) => {
              const photoId = clusterRows?.find((row) => Number(row.id) === clusterId)?.cover_photo_id;
              if (photoId) return [String(photoId)];

              const fallback = byCluster.get(clusterId);
              return fallback?.photoIds ? Array.from(fallback.photoIds).slice(0, 1) : [];
            })
            .filter(Boolean)
        )
      );

      const coverFaceIds = Array.from(
        new Set(
          (clusterRows || [])
            .map((row) => row.cover_face_id)
            .filter(Boolean)
            .map((id) => Number(id))
        )
      );

      let photoById = new Map<string, { path: string }>();
      let faceBboxById = new Map<number, any>();

      if (coverIds.length) {
        const { data: photoRows } = await supabase
          .from("photos")
          .select("id, path")
          .in("id", coverIds);

        photoById = new Map((photoRows || []).map((row) => [String(row.id), { path: row.path || "" }]));
      }

      if (coverFaceIds.length) {
        const { data: faceRows } = await supabase
          .from("face_embeddings")
          .select("id, bbox")
          .in("id", coverFaceIds);

        faceBboxById = new Map((faceRows || []).map((row) => [Number(row.id), row.bbox]));
      }

      const people = effectiveClusterIds.map((clusterId) => {
        const clusterMeta = clusterRows?.find((row) => Number(row.id) === clusterId);
        const group = byCluster.get(clusterId);
        const coverPhotoId = clusterMeta?.cover_photo_id
          ? String(clusterMeta.cover_photo_id)
          : Array.from(group?.photoIds || [])[0];
        const coverFaceId = clusterMeta?.cover_face_id ? Number(clusterMeta.cover_face_id) : null;

        return {
          id: clusterId,
          face_count: group?.faceCount || 0,
          photo_count: group?.photoIds.size || 0,
          cover_photo_id: coverPhotoId || null,
          cover_url: coverPhotoId ? photoById.get(coverPhotoId)?.path || null : null,
          cover_face_bbox: coverFaceId ? faceBboxById.get(coverFaceId) || null : null,
          updated_at: clusterMeta?.updated_at || null,
        };
      });

      return Response.json({ ok: true, people, pagination: { limit, offset, returned: people.length } });
    }

    const { data: clusters, error: clusterError } = await supabase
      .from("face_clusters")
      .select("id, face_count, cover_photo_id, cover_face_id, updated_at")
      .order("face_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (clusterError) {
      return Response.json({ error: clusterError.message }, { status: 500 });
    }

    const clusterIds = (clusters || []).map((row) => Number(row.id)).filter((value) => Number.isFinite(value));

    const { data: groupedFaces, error: groupedFacesError } = await supabase
      .from("face_embeddings")
      .select("cluster_id, photo_id, event_id")
      .in("cluster_id", clusterIds);

    if (groupedFacesError) {
      return Response.json({ error: groupedFacesError.message }, { status: 500 });
    }

    const statsByCluster = new Map<number, { photoIds: Set<string>; eventIds: Set<string> }>();
    for (const row of groupedFaces || []) {
      const clusterId = Number(row.cluster_id);
      if (!Number.isFinite(clusterId)) continue;

      const current = statsByCluster.get(clusterId) || { photoIds: new Set<string>(), eventIds: new Set<string>() };
      if (row.photo_id) current.photoIds.add(String(row.photo_id));
      if (row.event_id) current.eventIds.add(String(row.event_id));
      statsByCluster.set(clusterId, current);
    }

    const coverIds = Array.from(
      new Set((clusters || []).map((row) => row.cover_photo_id).filter(Boolean).map((id) => String(id)))
    );

    const coverFaceIds = Array.from(
      new Set((clusters || []).map((row) => row.cover_face_id).filter(Boolean).map((id) => Number(id)))
    );

    let coverById = new Map<string, string>();
    let faceBboxById = new Map<number, any>();

    if (coverIds.length) {
      const { data: coverRows } = await supabase
        .from("photos")
        .select("id, path")
        .in("id", coverIds);

      coverById = new Map((coverRows || []).map((row) => [String(row.id), row.path || ""]));
    }

    if (coverFaceIds.length) {
      const { data: faceRows } = await supabase
        .from("face_embeddings")
        .select("id, bbox")
        .in("id", coverFaceIds);

      faceBboxById = new Map((faceRows || []).map((row) => [Number(row.id), row.bbox]));
    }

    const people = (clusters || []).map((row) => {
      const clusterId = Number(row.id);
      const stats = statsByCluster.get(clusterId);
      const coverPhotoId = row.cover_photo_id ? String(row.cover_photo_id) : null;
      const coverFaceId = row.cover_face_id ? Number(row.cover_face_id) : null;

      return {
        id: clusterId,
        face_count: row.face_count || 0,
        photo_count: stats?.photoIds.size || 0,
        event_count: stats?.eventIds.size || 0,
        cover_photo_id: coverPhotoId,
        cover_url: coverPhotoId ? coverById.get(coverPhotoId) || null : null,
        cover_face_bbox: coverFaceId ? faceBboxById.get(coverFaceId) || null : null,
        updated_at: row.updated_at || null,
      };
    });

    return Response.json({ ok: true, people, pagination: { limit, offset, returned: people.length } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load people";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Apply rate limiting: 100 requests per minute per IP
export const GET = rateLimit(handler, rateLimitConfigs.standard);
