import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_slug, urls } = body || {};
    if (!event_slug || !urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }
    const rows = urls.map((url: string) => ({
      event_slug,
      url: (url || "").trim(),
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
