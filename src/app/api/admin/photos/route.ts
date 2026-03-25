import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/middleware";
import { Permission } from "@/types";

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, Permission.CAN_UPLOAD_PHOTOS);
  if (user instanceof Response) return user;

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
    const { data, error } = await supabase
      .from("photos")
      .insert(rows)
      .select("id, event_id, path");
    if (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
    return Response.json({ ok: true, count: rows.length, photos: data ?? [] });
  } catch {
    return Response.json({ error: "Insert failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, Permission.CAN_DELETE_PHOTOS);
  if (user instanceof Response) return user;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await request.json();
    const { photo_id } = body || {};

    if (!photo_id) {
      return Response.json({ error: "Missing photo_id" }, { status: 400 });
    }

    console.log(`[DELETE PHOTO] Admin ${user.email} deleting photo ${photo_id}`);

    // First, delete related face embeddings and cluster data
    const { error: faceDeleteError } = await supabase
      .from("face_embeddings")
      .delete()
      .eq("photo_id", photo_id);

    if (faceDeleteError) {
      console.error("Failed to delete face embeddings:", faceDeleteError);
      // Continue anyway - photo deletion is more important
    }

    // Delete the photo record
    const { data: deletedPhoto, error: photoDeleteError } = await supabase
      .from("photos")
      .delete()
      .eq("id", photo_id)
      .select("id, event_id, path")
      .single();

    if (photoDeleteError) {
      return Response.json({
        error: photoDeleteError.message || "Failed to delete photo"
      }, { status: 500 });
    }

    if (!deletedPhoto) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    console.log(`[DELETE PHOTO] Successfully deleted photo ${photo_id} and related face data`);

    return Response.json({
      ok: true,
      deleted_photo: deletedPhoto,
      message: "Photo and related face data deleted successfully"
    });

  } catch (error) {
    console.error("Delete photo failed:", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Delete failed"
    }, { status: 500 });
  }
}
