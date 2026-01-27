import { createClient } from "@supabase/supabase-js";

function authorize(request: Request): Response | null {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "Service misconfigured: ADMIN_API_TOKEN missing" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await request.json();
    const { event_id, event_slug, urls } = body || {};
    
    let id = event_id;
    if (!id && event_slug) {
      const { data: ev } = await supabase
        .from("events")
        .select("id")
        .eq("slug", event_slug)
        .maybeSingle();
      id = ev?.id;
    }
    
    if (!id || !urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "Missing event_id/slug or urls" }, { status: 400 });
    }
    
    const rows = urls.map((url: string) => ({
      event_id: id,
      path: (url || "").trim(),
    }));
    const { error } = await supabase.from("photos").insert(rows);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, count: rows.length });
  } catch {
    return Response.json({ error: "Insert failed" }, { status: 500 });
  }
}
