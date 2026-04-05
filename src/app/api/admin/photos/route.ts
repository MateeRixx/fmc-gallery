import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermissionCompat } from "@/lib/auth-utils";
import { Permission } from "@/types";

export async function POST(request: NextRequest) {
  const user = await requirePermissionCompat(request, Permission.CAN_UPLOAD_PHOTOS);
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
    // FIRE AND FORGET: Automatically AWS index the newly uploaded photos
    if (data && data.length > 0) {
      try {
        const payload = data.map((photo) => ({
          photo_id: photo.id,
          event_id: photo.event_id,
          image_url: supabase.storage.from("events").getPublicUrl(photo.path).data.publicUrl
        }));

        fetch(new URL("/api/admin/faces/index-aws", request.url).toString(), {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify({ photos: payload })
        }).catch(err => console.error("Background AWS indexing failed to launch:", err));
      } catch (err) {
        console.error("Could not trigger auto-indexing:", err);
      }
    }
    if (event_slug) {
      revalidatePath(`/events/${event_slug}`);
      revalidatePath(`/events`);
    } else {
      revalidatePath(`/events`);
    }
    return Response.json({ ok: true, count: rows.length, photos: data ?? [] });
  } catch {
    return Response.json({ error: "Insert failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requirePermissionCompat(request, Permission.CAN_DELETE_PHOTOS);
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

    // Delete the actual image file from Supabase Storage
    if (deletedPhoto.path) {
      const { error: storageError } = await supabase.storage
        .from("event-images")
        .remove([deletedPhoto.path]);
        
      if (storageError) {
        console.error("Failed to delete photo file from storage:", storageError.message);
      }
    }

    console.log(`[DELETE PHOTO] Successfully deleted photo ${photo_id} and related face data`);
    revalidatePath(`/events`);

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
