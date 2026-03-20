import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { clusterId: clusterIdRaw } = await params;
    const clusterId = Number(clusterIdRaw);

    if (!Number.isFinite(clusterId)) {
      return Response.json({ error: "Invalid cluster id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");

    let query = supabase
      .from("face_embeddings")
      .select("photo_id, event_id, bbox, quality_score")
      .eq("cluster_id", clusterId)
      .order("quality_score", { ascending: false });

    if (eventId) {
      query = query.eq("event_id", eventId);
    }

    const { data: faceRows, error: faceError } = await query;

    if (faceError) {
      return Response.json({ error: faceError.message }, { status: 500 });
    }

    const bestByPhoto = new Map<string, { event_id: string; bbox: unknown; quality_score: number }>();
    for (const row of faceRows || []) {
      const photoId = String(row.photo_id || "");
      if (!photoId) continue;

      const existing = bestByPhoto.get(photoId);
      const score = Number(row.quality_score || 0);
      if (!existing || score > existing.quality_score) {
        bestByPhoto.set(photoId, {
          event_id: String(row.event_id || ""),
          bbox: row.bbox,
          quality_score: score,
        });
      }
    }

    const photoIds = Array.from(bestByPhoto.keys());
    if (!photoIds.length) {
      return Response.json({ ok: true, cluster_id: clusterId, photos: [] });
    }

    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("id, path, event_id")
      .in("id", photoIds);

    if (photosError) {
      return Response.json({ error: photosError.message }, { status: 500 });
    }

    const eventIds = Array.from(new Set((photos || []).map((photo) => String(photo.event_id)).filter(Boolean)));

    let eventMetaById = new Map<string, { slug: string | null; title: string | null }>();
    if (eventIds.length) {
      const { data: events } = await supabase
        .from("events")
        .select("id, slug, title")
        .in("id", eventIds);

      eventMetaById = new Map(
        (events || []).map((event) => [String(event.id), { slug: event.slug || null, title: event.title || null }])
      );
    }

    const responsePhotos = (photos || []).map((photo) => {
      const key = String(photo.id);
      const faceMeta = bestByPhoto.get(key);
      const eventMeta = eventMetaById.get(String(photo.event_id));

      return {
        photo_id: key,
        event_id: String(photo.event_id || ""),
        photo_url: (photo.path || "").trim().replace(/\)+$/, ""),
        bbox: faceMeta?.bbox || null,
        quality_score: faceMeta?.quality_score || 0,
        event_slug: eventMeta?.slug || null,
        event_title: eventMeta?.title || null,
      };
    });

    return Response.json({
      ok: true,
      cluster_id: clusterId,
      count: responsePhotos.length,
      photos: responsePhotos,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load person photos";
    return Response.json({ error: msg }, { status: 500 });
  }
}
