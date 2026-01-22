import { getSupabaseServer } from "@/lib/supabaseServer";

async function getSupabase() {
  try {
    return await getSupabaseServer();
  } catch (err) {
    if (err instanceof Error) {
      console.error("Supabase initialization failed:", err.message);
    } else {
      console.error("Supabase initialization failed:", err);
    }
    throw err;
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabase();
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ error: "Invalid id" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("events")
        .select("id, title, slug, description, cover_url, bg_url")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ data });
    }
    const { data, error } = await supabase
      .from("events")
      .select("id, title")
      .order("id", { ascending: true });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ data });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Fetch failed";
    console.error("GET /api/admin/events error:", err);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabase();
    const body = await request.json();
    const { title, slug, description, starts_at } = body || {};
    
    console.log("POST /api/admin/events - Received:", { title, slug, description, starts_at });
    
    if (!title || !slug || !description) {
      console.error("Missing required fields");
      return Response.json({ error: "Missing fields: title, slug, description" }, { status: 400 });
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return Response.json({ error: "Unauthorized: must be logged in" }, { status: 401 });
    }

    const row: Record<string, unknown> = { 
      title, 
      slug, 
      description, 
      is_public: true,
      starts_at: starts_at || new Date().toISOString(),
      user_id: user.id  // Set user_id from authenticated user
    };

    console.log("Inserting into events table:", { ...row, user_id: user.id });
    
    const { data, error } = await supabase.from("events").insert(row).select();
    
    if (error) {
      console.error("Insert error:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      console.error("Row being inserted:", row);
      return Response.json({ 
        error: error.message,
        details: JSON.stringify(error),
        code: error.code,
        hint: (error as any).hint
      }, { status: 500 });
    }

    console.log("Successfully inserted event:", data);
    return Response.json({ ok: true, data });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Insert failed";
    console.error("POST /api/admin/events error:", err);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getSupabase();
    const body = await request.json();
    const { id, title, slug, description, starts_at } = body || {};
    if (!id || !Number.isFinite(Number(id))) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (typeof title === "string") updates.title = title.trim();
    if (typeof slug === "string") updates.slug = slug.trim().toLowerCase();
    if (typeof description === "string") updates.description = description.trim();
    if (typeof starts_at === "string") updates.starts_at = starts_at.trim();
    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }
    const { error } = await supabase.from("events").update(updates).eq("id", Number(id));
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Update failed";
    console.error("PUT /api/admin/events error:", err);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getSupabase();
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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Delete failed";
    console.error("DELETE /api/admin/events error:", err);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
