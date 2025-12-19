import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_slug, url } = body;

    if (!event_slug || !url) {
      return Response.json(
        { error: "Missing event_slug or url" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("photos")
      .insert({ event_slug, url })
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true, data });
  } catch (err: any) {
    console.error("API error:", err);
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
