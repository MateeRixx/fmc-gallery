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
    const { photo_id, photo_ids, photo_paths } = body || {};

    if (!photo_id && (!photo_ids || !Array.isArray(photo_ids) || photo_ids.length === 0) && (!photo_paths || !Array.isArray(photo_paths) || photo_paths.length === 0)) {
      return Response.json({ error: "Missing photo_id, photo_ids, or photo_paths" }, { status: 400 });
    }

    let idsToDelete: string[] = [];
    let photosToDelete: any[] = [];

    if (photo_paths && Array.isArray(photo_paths) && photo_paths.length > 0) {
      // Find photos by path
      const { data: foundPhotos, error: fetchError } = await supabase
        .from("photos")
        .select("id, path")
        .in("path", photo_paths);

      if (fetchError || !foundPhotos || foundPhotos.length === 0) {
        return Response.json({ error: "Photos not found by path" }, { status: 404 });
      }
      photosToDelete = foundPhotos;
      idsToDelete = foundPhotos.map(p => p.id);
    } else {
      idsToDelete = photo_id ? [photo_id] : photo_ids;
      
      // Fetch the paths to delete from storage later
      const { data: foundPhotos, error: fetchError } = await supabase
        .from("photos")
        .select("id, path")
        .in("id", idsToDelete);

      if (fetchError || !foundPhotos || foundPhotos.length === 0) {
        return Response.json({ error: "Photos not found or fetch error" }, { status: 404 });
      }
      photosToDelete = foundPhotos;
    }

    console.log(`[DELETE PHOTO] Admin ${user.email} deleting photos: ${idsToDelete.join(", ")}`);

    // First, delete related face embeddings and cluster data
    const { error: faceDeleteError } = await supabase
      .from("face_embeddings")
      .delete()
      .in("photo_id", idsToDelete);

    if (faceDeleteError) {
      console.error("Failed to delete face embeddings:", faceDeleteError);
      // Continue anyway - photo deletion is more important
    }

    // Delete the photo records
    const { error: photoDeleteError } = await supabase
      .from("photos")
      .delete()
      .in("id", idsToDelete);

    if (photoDeleteError) {
      return Response.json({
        error: photoDeleteError.message || "Failed to delete photos"
      }, { status: 500 });
    }

    // Delete the actual image files from Supabase Storage
    const pathsToDelete = photosToDelete.map(p => {
      if (!p.path) return null;
      // Extract relative path from Supabase full URL if necessary
      if (p.path.includes("/storage/v1/object/public/event-images/")) {
        return p.path.split("/storage/v1/object/public/event-images/")[1];
      }
      return p.path;
    }).filter(Boolean);

    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("event-images")
        .remove(pathsToDelete as string[]);
        
      if (storageError) {
        console.error("Failed to delete photo files from storage:", storageError.message);
      }
    }

    console.log(`[DELETE PHOTO] Successfully deleted ${idsToDelete.length} photos and related face data`);
    revalidatePath(`/events`);

    return Response.json({
      ok: true,
      deleted_count: idsToDelete.length,
      message: "Photos and related face data deleted successfully"
    });
  } catch (error) {
    console.error("Delete photo failed:", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Delete failed"
    }, { status: 500 });
  }
}
