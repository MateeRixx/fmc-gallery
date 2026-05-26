import { rateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { FaceSearchSchema, validationErrorResponse } from "@/lib/validate";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function handler(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();

    // Validate with Zod
    let validated;
    try {
      validated = FaceSearchSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(error);
      }
      throw error;
    }

    const { query: embedding, event_id: eventId, limit, offset, threshold } = validated;

    const vector = `[${embedding.join(",")}]`;

    // Fetch results with limit + offset handling
    const { data, error } = await supabase.rpc("search_similar_faces", {
      query_embedding: vector,
      filter_event_id: eventId ?? null,
      match_threshold: threshold,
      match_limit: limit + offset, // Fetch extra to handle offset
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const rows = ((data || []) as Array<{
      face_id: number;
      photo_id: string;
      event_id: string;
      bbox: { x: number; y: number; width: number; height: number };
      photo_url: string;
      similarity: number;
    }>).slice(offset, offset + limit); // Apply offset

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

    return Response.json({
      ok: true,
      results: enriched,
      pagination: {
        limit,
        offset,
        returned: enriched.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Apply rate limiting: 100 requests per minute per IP
export const POST = rateLimit(handler, rateLimitConfigs.standard);

