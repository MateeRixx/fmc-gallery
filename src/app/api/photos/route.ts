import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_id, event_slug, url } = body;

    let id = event_id;
    if (!id && event_slug) {
      const sb = await getSupabaseServer();
      const { data: ev } = await sb
        .from("events")
        .select("id")
        .eq("slug", event_slug)
        .maybeSingle();
      id = ev?.id;
    }

    if (!id || !url) {
      return Response.json(
        { error: "Missing event_id/slug or url" },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = await getSupabaseServer();
    } catch (err: unknown) {
      console.error("Supabase initialization error:", err);
      return Response.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from("photos")
      .insert({ event_id: id, path: url })
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true, data });
  } catch (err: unknown) {
    console.error("API error:", err);
    const message =
      err instanceof Error ? err.message : String(err ?? "Internal server error");
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}
