import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ error: "Invalid id" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("events")
        .select("id, name, slug, description, cover_url, bg_url")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ data });
    }
    const { data, error } = await supabase
      .from("events")
      .select("id, name")
      .order("id", { ascending: true });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ data });
  } catch {
    return Response.json({ error: "Fetch failed" }, { status: 500 });
  }
}

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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, slug, description, cover_url, bg_url } = body || {};
    if (!id || !Number.isFinite(Number(id))) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof slug === "string") updates.slug = slug.trim().toLowerCase();
    if (typeof description === "string") updates.description = description.trim();
    if (typeof cover_url === "string") updates.cover_url = cover_url.trim();
    if (typeof bg_url === "string") updates.bg_url = bg_url.trim();
    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }
    const { error } = await supabase.from("events").update(updates).eq("id", Number(id));
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    let id = idParam ? Number(idParam) : undefined;
    if (!id) {
      const body = await request.json().catch(() => null);
      id = body && Number(body.id);
    }
    if (!id || !Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
