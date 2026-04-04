import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermissionCompat } from "@/lib/auth-utils";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  const user = await requirePermissionCompat(request, Permission.CAN_UPLOAD_PHOTOS);
  if (user instanceof Response) return user;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get counts
    const { count: totalPhotos } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true });

    const { count: totalEmbeddings } = await supabase
      .from("face_embeddings")
      .select("*", { count: "exact", head: true });

    const { count: totalClusters } = await supabase
      .from("face_clusters")
      .select("*", { count: "exact", head: true });

    // Get unique photo IDs with embeddings
    const { data: embeddingPhotos } = await supabase
      .from("face_embeddings")
      .select("photo_id");

    const uniquePhotosWithEmbeddings = new Set(
      (embeddingPhotos || []).map((e) => Number(e.photo_id))
    ).size;

    return Response.json({
      ok: true,
      stats: {
        total_photos: totalPhotos || 0,
        total_embeddings: totalEmbeddings || 0,
        total_clusters: totalClusters || 0,
        photos_with_embeddings: uniquePhotosWithEmbeddings,
        photos_without_embeddings: (totalPhotos || 0) - uniquePhotosWithEmbeddings,
      },
    });
  } catch (err) {
    console.error("Stats API error:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch stats";
    return Response.json({ error: msg }, { status: 500 });
  }
}
