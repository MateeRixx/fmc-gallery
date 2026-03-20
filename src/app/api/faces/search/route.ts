import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await request.json();
    const embedding = body?.embedding as number[] | undefined;
    const eventId = body?.event_id as string | null | undefined;
    const threshold = Number(body?.threshold ?? 0.35);
    const limit = Number(body?.limit ?? 60);

    if (!Array.isArray(embedding) || embedding.length !== 128) {
      return Response.json({ error: "embedding(128) is required" }, { status: 400 });
    }

    if (Number.isNaN(threshold) || threshold <= 0) {
      return Response.json({ error: "threshold must be a positive number" }, { status: 400 });
    }

    if (Number.isNaN(limit) || limit <= 0 || limit > 200) {
      return Response.json({ error: "limit must be between 1 and 200" }, { status: 400 });
    }

    const vector = `[${embedding.join(",")}]`;

    const { data, error } = await supabase.rpc("search_similar_faces", {
      query_embedding: vector,
      filter_event_id: eventId ?? null,
      match_threshold: threshold,
      match_limit: limit,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as Array<{
      face_id: number;
      photo_id: string;
      event_id: string;
      bbox: { x: number; y: number; width: number; height: number };
      photo_url: string;
      similarity: number;
    }>;

    const uniqueEventIds = Array.from(new Set(rows.map((row) => row.event_id))).filter(Boolean);

    const eventMetaById = new Map<string, { slug: string | null; title: string | null }>();
    if (uniqueEventIds.length > 0) {
      const { data: eventRows, error: eventError } = await supabase
        .from("events")
        .select("id, slug, title")
        .in("id", uniqueEventIds);

      if (eventError) {
        return Response.json({ error: eventError.message }, { status: 500 });
      }

      for (const event of eventRows || []) {
        eventMetaById.set(String(event.id), {
          slug: event.slug || null,
          title: event.title || null,
        });
      }
    }

    const enriched = rows.map((row) => {
      const meta = eventMetaById.get(String(row.event_id));
      return {
        ...row,
        event_slug: meta?.slug || null,
        event_title: meta?.title || null,
      };
    });

    return Response.json({ ok: true, results: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
