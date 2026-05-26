import { NextRequest } from "next/server";
import { requirePermissionCompat } from "@/lib/auth-utils";
import { Permission } from "@/types";
import { indexFacesFromImageBytes, searchUsersByFaceId } from "@/lib/awsRekognition";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
  const user = await requirePermissionCompat(request, Permission.CAN_UPLOAD_PHOTOS);
  if (user instanceof Response) return user;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const photos = body?.photos as AwsIndexPhotoPayload[] | undefined;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return Response.json({ error: "photos array is required" }, { status: 400 });
    }

    let indexedFaces = 0;
    const newFaceIds: number[] = [];
    const failures: Array<{ photo_id: string; error: string }> = [];

    // Early validation for the entire payload
    const invalidImageIndex = photos.findIndex(p => !p.photo_id || !p.event_id || !p.image_url);
    if (invalidImageIndex !== -1) {
      return Response.json(
        { error: "photo_id, event_id, and image_url are required for each photo" },
        { status: 400 }
      );
    }

    // Process all photos in parallel concurrently rather than sequentially
    // This allows AWS network calls (fetch, rekognition) to happen simultaneously
    await Promise.all(photos.map(async (photo) => {
      try {
        const imageUrl = resolveImageUrl(photo.image_url, request.url);
        if (!imageUrl) {
          failures.push({ photo_id: photo.photo_id, error: "Invalid image_url" });
          return;
        }

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          const fetchErr = `Image fetch failed (${imageResponse.status})`;
          console.error(`[FETCH ERROR] Photo ${photo.photo_id}:`, fetchErr);
          failures.push({
            photo_id: photo.photo_id,
            error: fetchErr,
          });
          return;
        }

        const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
        const awsFaces = await indexFacesFromImageBytes({
          imageBytes,
          externalImageId: String(photo.photo_id),
        });

        if (awsFaces.length === 0) {
          return;
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
          const errMsg = `Supabase insert failed: ${error.message}`;
          console.error(`[INDEXING ERROR] Photo ${photo.photo_id}:`, errMsg);
          failures.push({ photo_id: photo.photo_id, error: errMsg });
          return;
        }

        // Collect new face IDs for incremental clustering
        if (insertedFaces) {
          newFaceIds.push(...insertedFaces.map((f: any) => Number(f.id)).filter(Number.isFinite));
        }

        indexedFaces += rows.length;

        // Perform automatic User Matching (Supervised Classification via AWS Users)
        // Parallellize search constraints over all detected faces as well
        await Promise.all(awsFaces.map(async (face) => {
          try {
            const matchedUsers = await searchUsersByFaceId({
              awsFaceId: face.awsFaceId,
              similarityThreshold: 85 // Strict matching for auto-tagging
            });

            if (matchedUsers.length > 0) {
              const bestMatch = matchedUsers[0]; // Highest similarity first
              const userId = bestMatch.userId;

              // Find the profile ID for this user ID
              const { data: profile } = await supabase
                .from("visitor_profiles")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();

              if (profile) {
                // Instantly tag the user to this photo!
                const matchRecord = {
                  visitor_profile_id: profile.id,
                  photo_id: photo.photo_id,
                  similarity_score: Math.round(bestMatch.similarity * 100),
                  face_bounding_box: face.bbox
                };

                await supabase
                  .from("user_photo_matches")
                  .upsert([matchRecord], {
                    onConflict: "visitor_profile_id, photo_id",
                    ignoreDuplicates: true
                  });

                console.log(`Auto-tagged user ${userId} to photo ${photo.photo_id} (Score: ${bestMatch.similarity}%)`);
              }
            }
          } catch (matchErr) {
            console.error(`Failed to finding matching user for face ${face.awsFaceId}:`, matchErr);
          }
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[AWS INDEXING ERROR] Photo ${photo.photo_id}:`, message);
        failures.push({ photo_id: photo.photo_id, error: message });
      }
    }));

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
