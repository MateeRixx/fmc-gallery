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
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || "100"), 500);
    const mode = (searchParams.get("mode") || "any").toLowerCase();

    // Find all photos first (remove problematic .not() filters)
    const { data: allPhotos, error: photosError } = await supabase
      .from("photos")
      .select("id, event_id, path")
      .order("id", { ascending: true })
      .limit(limit);

    if (photosError) {
      console.error("Photos query error:", photosError);
      return Response.json({ error: photosError.message }, { status: 500 });
    }

    console.log(`Total photos fetched: ${allPhotos?.length || 0}`);

    // Filter out null values in TypeScript
    const validPhotos = (allPhotos || []).filter(
      (p) => p.id && p.event_id && p.path
    );

    console.log(`Valid photos (with id, event_id, path): ${validPhotos.length}`);

    if (validPhotos.length === 0) {
      return Response.json({ ok: true, photos: [], total_unprocessed: 0 });
    }

    // Keep IDs as strings to avoid NaN issues with BigInt
    const photoIds = validPhotos.map((p) => String(p.id));

    // Get photos that are already processed.
    // mode=aws => any row with aws_face_id means processed.
    // mode=any => any face_embeddings row means processed.
    let processedQuery = supabase
      .from("face_embeddings")
      .select("photo_id")
      .in("photo_id", photoIds);

    if (mode === "aws") {
      processedQuery = processedQuery.not("aws_face_id", "is", null);
    }

    const { data: processedPhotos, error: embeddingsError } = await processedQuery;

    if (embeddingsError) {
      console.error("Embeddings query error:", embeddingsError);
      return Response.json({ error: embeddingsError.message }, { status: 500 });
    }

    const processedPhotoIds = new Set(
      (processedPhotos || []).map((p) => String(p.photo_id))
    );

    console.log(`Photos with embeddings: ${processedPhotoIds.size}`);

    // Filter to only unprocessed photos
    const unprocessedPhotos = validPhotos
      .filter((photo) => !processedPhotoIds.has(String(photo.id)))
      .map((photo) => ({
        id: String(photo.id),
        event_id: String(photo.event_id),
        path: String(photo.path),
      }));

    console.log(`Unprocessed photos: ${unprocessedPhotos.length}`);

    return Response.json({
      ok: true,
      mode,
      photos: unprocessedPhotos,
      total_unprocessed: unprocessedPhotos.length,
    });
  } catch (err) {
    console.error("Unprocessed photos API error:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch unprocessed photos";
    return Response.json({ error: msg }, { status: 500 });
  }
}
