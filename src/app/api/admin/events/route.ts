import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, description, cover_url, bg_url } = body || {};
    if (!name || !slug || !description || !cover_url) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const row: Record<string, unknown> = { name, slug, description, cover_url };
    if (bg_url) row.bg_url = bg_url;

    const { error } = await supabase.from("events").insert(row);
    if (error) {
      // Fallback: if bg_url column doesn't exist, insert without it
      if (/bg_url/i.test(error.message)) {
        const { error: retryErr } = await supabase.from("events").insert({ name, slug, description, cover_url });
        if (retryErr) {
          return Response.json({ error: retryErr.message }, { status: 500 });
        }
      } else {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Insert failed" }, { status: 500 });
  }
}
