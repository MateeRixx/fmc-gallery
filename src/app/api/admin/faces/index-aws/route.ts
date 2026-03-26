import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/middleware";
import { Permission } from "@/types";
import { indexFacesFromImageBytes } from "@/lib/awsRekognition";

export const runtime = "nodejs";

type AwsIndexPhotoPayload = {
  photo_id: string;
  event_id: string;
  image_url: string;
};

function resolveImageUrl(rawUrl: string, requestUrl: string): string {
  const cleaned = String(rawUrl || "").trim();
  if (!cleaned) return "";

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  const origin = new URL(requestUrl).origin;
  if (cleaned.startsWith("/")) {
    return `${origin}${cleaned}`;
  }

  return `${origin}/${cleaned}`;
}

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
    const photos = body?.photos as AwsIndexPhotoPayload[] | undefined;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return Response.json({ error: "photos array is required" }, { status: 400 });
    }

    let indexedFaces = 0;
    const newFaceIds: number[] = [];
    const failures: Array<{ photo_id: string; error: string }> = [];

    for (const photo of photos) {
      if (!photo.photo_id || !photo.event_id || !photo.image_url) {
        return Response.json(
          { error: "photo_id, event_id, and image_url are required for each photo" },
          { status: 400 }
        );
      }

      try {
        const imageUrl = resolveImageUrl(photo.image_url, request.url);
        if (!imageUrl) {
          failures.push({ photo_id: photo.photo_id, error: "Invalid image_url" });
          continue;
        }

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          failures.push({
            photo_id: photo.photo_id,
            error: `Image fetch failed (${imageResponse.status})`,
          });
          continue;
        }

        const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
        const awsFaces = await indexFacesFromImageBytes({
          imageBytes,
          externalImageId: String(photo.photo_id),
        });

        if (awsFaces.length === 0) {
          continue;
        }

        // Keep embedding nullable for AWS-only indexed faces.
        const rows = awsFaces.map((face) => ({
          photo_id: photo.photo_id,
          event_id: photo.event_id,
          embedding: null,
          aws_face_id: face.awsFaceId,
          bbox: face.bbox,
          quality_score: face.qualityScore,
          detection_method: "aws",
          aws_indexed_at: new Date().toISOString(),
        }));

        const { data: insertedFaces, error } = await supabase
          .from("face_embeddings")
          .insert(rows)
          .select("id");

        if (error) {
          failures.push({ photo_id: photo.photo_id, error: error.message });
          continue;
        }

        // Collect new face IDs for incremental clustering
        if (insertedFaces) {
          newFaceIds.push(...insertedFaces.map((f: any) => Number(f.id)).filter(Number.isFinite));
        }

        indexedFaces += rows.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ photo_id: photo.photo_id, error: message });
      }
    }

    return Response.json({
      ok: true,
      indexed_faces: indexedFaces,
      failed_photos: failures.length,
      new_face_ids: newFaceIds,
      failures,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AWS face indexing failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
