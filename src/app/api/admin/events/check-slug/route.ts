import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, excludeId } = body;

    if (!slug || typeof slug !== "string") {
      return Response.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = getSupabaseServer();
    } catch (err: any) {
      console.error("Supabase initialization error:", err.message);
      return Response.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }
    
    let query = supabase
      .from("events")
      .select("id")
      .eq("slug", slug.toLowerCase().trim());

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Slug check error:", error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ exists: !!data });
  } catch (err: any) {
    console.error("API error:", err);
    return Response.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
