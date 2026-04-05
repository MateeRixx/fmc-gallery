/**
 * API Route: POST /api/admin/import-from-drive
 *
 * Imports all PNG/JPEG images from a public Google Drive folder into a gallery event.
 * The folder must be shared as "Anyone with the link can view".
 *
 * Body: { folder_url: string, event_slug: string }
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthCompat } from "@/lib/auth-utils";
import { hasPermission, isSupremeAdmin } from "@/lib/rbac";
import { Permission } from "@/types";
import { indexFacesFromImageBytes } from "@/lib/awsRekognition";

import sharp from "sharp";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const MAX_FILES = 300;

function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  try {
    const parsedUrl = new URL(url);
    const queryId = parsedUrl.searchParams.get("id");
    return queryId || null;
  } catch {
    return null;
  }
}

async function listDriveImages(folderId: string, apiKey: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const mimeFilter = ALLOWED_MIME.map((m) => `mimeType='${m}'`).join(" or ");
  const q = encodeURIComponent(`'${folderId}' in parents and (${mimeFilter}) and trashed=false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType)");

  const files: { id: string; name: string; mimeType: string }[] = [];
  let pageToken = "";

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const res = await fetch(
      `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${apiKey}${tokenParam}`
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Drive API error: ${res.status}`);
    }

    const json = await res.json();
    files.push(...(json.files || []));
    pageToken = json.nextPageToken || "";
  } while (pageToken && files.length < MAX_FILES);

  return files.slice(0, MAX_FILES);
}

async function downloadDriveFile(fileId: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true&key=${apiKey}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to download file ${fileId}: ${res.status}`);
  }
  return res.arrayBuffer();
}

function getGoogleDriveApiKey() {
  const candidates = [
    "GOOGLE_DRIVE_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_DRIVE_KEY",
    "GOOGLE_DRIVE_TOKEN",
    "GOOGLE_API_TOKEN",
  ] as const;

  for (const name of candidates) {
    const value = process.env[name];
    if (value && value.trim()) {
      return { name, value: value.trim() };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthCompat(request);
  if (authResult instanceof Response) return authResult;

  const canUpload = isSupremeAdmin(authResult.role) || hasPermission(authResult, Permission.CAN_UPLOAD_PHOTOS);
  if (!canUpload) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const driveApiKey = getGoogleDriveApiKey();
  if (!driveApiKey) {
    return Response.json({
      error: "Google Drive API key not configured. Set GOOGLE_DRIVE_API_KEY or GOOGLE_API_KEY in Vercel.",
    }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Service misconfigured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const { folder_url, event_slug } = body || {};

  if (!folder_url || typeof folder_url !== "string") {
    return Response.json({ error: "folder_url is required" }, { status: 400 });
  }
  if (!event_slug || typeof event_slug !== "string") {
    return Response.json({ error: "event_slug is required" }, { status: 400 });
  }

  const folderId = extractFolderId(folder_url);
  if (!folderId) {
    return Response.json(
      { error: "Invalid Google Drive folder URL. It should look like: https://drive.google.com/drive/folders/..." },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Resolve event_slug → event_id
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("slug", event_slug)
    .maybeSingle();

  if (eventError || !event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // List image files from Drive
  let driveFiles: { id: string; name: string; mimeType: string }[];
  try {
    driveFiles = await listDriveImages(folderId, driveApiKey.value);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Could not read Drive folder: ${msg}` }, { status: 400 });
  }

  if (driveFiles.length === 0) {
    return Response.json({ error: "No PNG or JPEG images found in that folder" }, { status: 404 });
  }

  // Return SSE stream for progress tracking
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const errors: string[] = [];
      const newFaceIds: number[] = [];
      const total = driveFiles.length;
      let importedCount = 0;
      let indexedFaces = 0;

      try {
        for (let i = 0; i < driveFiles.length; i++) {
          const file = driveFiles[i];
          const progress = Math.round(((i + 1) / total) * 100);

          try {
            const arrayBuffer = await downloadDriveFile(file.id, driveApiKey.value); 
            const buffer = Buffer.from(arrayBuffer);

            // Compress using sharp
            const compressedBuffer = await sharp(buffer)
              .resize(1920, 1920, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ quality: 75, mozjpeg: true })
              .toBuffer();

            const finalExt = "jpg";
            const finalMime = "image/jpeg";
            const storagePath = `${event_slug}/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${finalExt}`;

            const { error: uploadError } = await supabase.storage
              .from("event-images")
              .upload(storagePath, compressedBuffer, { contentType: finalMime });     

            if (uploadError) {
              errors.push(`${file.name}: ${uploadError.message}`);
            } else {
              const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(storagePath);
              const publicUrl = urlData.publicUrl;
              const { data: savedPhoto, error: photoInsertError } = await supabase
                .from("photos")
                .insert({ event_id: event.id, path: publicUrl })
                .select("id, event_id, path")
                .single();

              if (photoInsertError || !savedPhoto) {
                errors.push(`${file.name}: ${photoInsertError?.message || "Failed to save photo record"}`);
              } else {
                importedCount += 1;

                const awsFaces = await indexFacesFromImageBytes({
                  imageBytes: new Uint8Array(buffer),
                  externalImageId: String(savedPhoto.id),
                });

                if (awsFaces.length > 0) {
                  const faceRows = awsFaces.map((face) => ({
                    photo_id: savedPhoto.id,
                    event_id: savedPhoto.event_id,
                    embedding: null,
                    aws_face_id: face.awsFaceId,
                    bbox: face.bbox,
                    quality_score: face.qualityScore,
                    detection_method: "aws",
                    aws_indexed_at: new Date().toISOString(),
                  }));

                  const { data: insertedFaces, error: faceInsertError } = await supabase
                    .from("face_embeddings")
                    .insert(faceRows)
                    .select("id");

                  if (faceInsertError) {
                    errors.push(`${file.name}: ${faceInsertError.message}`);
                  } else {
                    indexedFaces += faceRows.length;
                    newFaceIds.push(
                      ...(insertedFaces || [])
                        .map((face) => Number(face.id))
                        .filter((id) => Number.isFinite(id))
                    );
                  }
                }
              }
            }
          } catch (err) {
            errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
          }

          // Send progress update
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                progress,
                current: i + 1,
                total,
                imported: importedCount,
                indexed_faces: indexedFaces,
                status: `Processed ${i + 1}/${total} images...`,
              })}\n\n`
            )
          );
        }

        
        

        // Send final result
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              complete: true,
              count: importedCount,
              indexed_faces: indexedFaces,
              skipped: errors.length,
              errors: errors.length > 0 ? errors : undefined,
            })}\n\n`
          )
        );

        if (event_slug) {
          revalidatePath(`/events/${event_slug}`);
          revalidatePath(`/events`);
        } else {
          revalidatePath(`/events`);
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: msg,
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
