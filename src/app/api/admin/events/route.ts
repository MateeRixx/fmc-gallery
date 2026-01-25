import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeId(raw: unknown): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed; // allow UUID-style ids
  }
  return null;
}

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

function getSupabaseWrite() {
  try {
    return getSupabaseAdmin();
  } catch (err) {
    if (err instanceof Error) {
      console.error("Supabase admin initialization failed:", err.message);
    } else {
      console.error("Supabase admin initialization failed:", err);
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
      const id = normalizeId(idParam);
      if (!id) {
        return Response.json({ error: "Invalid id" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("events")
        .select("id, title, slug, description, cover_url, hero_image_url")
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
    const supabase = getSupabaseWrite();
    const body = await request.json();
    const { title, slug, description, starts_at, cover_url, hero_image_url } = body || {};
    
    console.log("POST /api/admin/events - Received:", { title, slug, description, starts_at });
    
    if (!title || !slug || !description) {
      console.error("Missing required fields");
      return Response.json({ error: "Missing fields: title, slug, description" }, { status: 400 });
    }

    const row: Record<string, unknown> = { 
      title: String(title).trim(),
      slug: String(slug).trim().toLowerCase(),
      description: String(description).trim(),
      is_public: true,
      starts_at: (starts_at && String(starts_at)) || new Date().toISOString(),
      user_id: null,
    };

    if (typeof cover_url === "string" && cover_url.trim()) {
      row.cover_url = cover_url.trim();
    }

    if (typeof hero_image_url === "string" && hero_image_url.trim()) {
      row.hero_image_url = hero_image_url.trim();
    }

    console.log("Inserting into events table:", row);
    
    const { data, error } = await supabase.from("events").insert(row).select();
    
    if (error) {
      console.error("Insert error:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      console.error("Row being inserted:", row);
      const errObj = error as unknown;
      const code =
        errObj && typeof errObj === "object" && "code" in errObj
          ? (errObj as Record<string, unknown>).code
          : undefined;
      const hint =
        errObj && typeof errObj === "object" && "hint" in errObj
          ? (errObj as Record<string, unknown>).hint
          : undefined;
      const message =
        errObj && typeof errObj === "object" && "message" in errObj
          ? String((errObj as Record<string, unknown>).message)
          : String(error);
      return Response.json(
        {
          error: message,
          details: JSON.stringify(error),
          code,
          hint,
        },
        { status: 500 }
      );
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
    const supabase = getSupabaseWrite();
    const body = await request.json();
    const { id: rawId, title, slug, description, starts_at, cover_url, hero_image_url } = body || {};
    const id = normalizeId(rawId);
    if (!id) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (typeof title === "string") updates.title = title.trim();
    if (typeof slug === "string") updates.slug = slug.trim().toLowerCase();
    if (typeof description === "string") updates.description = description.trim();
    if (typeof starts_at === "string") updates.starts_at = starts_at.trim();
    if (typeof cover_url === "string" && cover_url.trim()) updates.cover_url = cover_url.trim();
    if (typeof hero_image_url === "string" && hero_image_url.trim()) updates.hero_image_url = hero_image_url.trim();
    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }
    const { error } = await supabase.from("events").update(updates).eq("id", id);
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
    const supabase = getSupabaseWrite();
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    let id: string | number | null = idParam ? normalizeId(idParam) : null;
    if (!id) {
      const body: unknown = await request.json().catch(() => null);
      if (body && typeof body === "object" && "id" in body) {
        id = normalizeId((body as Record<string, unknown>).id);
      } else {
        id = null;
      }
    }
    if (!id) {
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
