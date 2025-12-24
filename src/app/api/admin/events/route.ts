import { getSupabaseServer } from "@/lib/supabaseServer";

function getSupabase() {
  try {
    return getSupabaseServer();
  } catch (err: any) {
    console.error("Supabase initialization failed:", err.message);
    throw err;
  }
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
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
  } catch (err: any) {
    console.error("GET /api/admin/events error:", err);
    return Response.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { name, slug, description, cover_url, bg_url } = body || {};
    
    console.log("POST /api/admin/events - Received:", { name, slug, description, cover_url: !!cover_url, bg_url: !!bg_url });
    
    if (!name || !slug || !description || !cover_url) {
      console.error("Missing required fields");
      return Response.json({ error: "Missing fields: name, slug, description, cover_url" }, { status: 400 });
    }

    const row: Record<string, unknown> = { name, slug, description, cover_url };
    if (bg_url) row.bg_url = bg_url;

    console.log("Inserting into events table:", row);
    
    const { data, error } = await supabase.from("events").insert(row).select();
    
    if (error) {
      console.error("Insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.log("Successfully inserted event:", data);
    return Response.json({ ok: true, data });
  } catch (err: any) {
    console.error("POST /api/admin/events error:", err);
    return Response.json({ error: err.message || "Insert failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabase();
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
  } catch (err: any) {
    console.error("PUT /api/admin/events error:", err);
    return Response.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabase();
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
  } catch (err: any) {
    console.error("DELETE /api/admin/events error:", err);
    return Response.json({ error: err.message || "Delete failed" }, { status: 500 });
  }
}
