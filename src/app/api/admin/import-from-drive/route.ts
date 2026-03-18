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
import { requireAuth } from "@/lib/middleware";
import { hasPermission, isSupremeAdmin } from "@/lib/rbac";
import { Permission } from "@/types";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const MAX_FILES = 300;

function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
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
      `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=100&key=${apiKey}${tokenParam}`
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
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&key=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to download file ${fileId}: ${res.status}`);
  return res.arrayBuffer();
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const canUpload = isSupremeAdmin(authResult.role) || hasPermission(authResult, Permission.CAN_UPLOAD_PHOTOS);
  if (!canUpload) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Google Drive API key not configured" }, { status: 500 });
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
    driveFiles = await listDriveImages(folderId, apiKey);
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
      const uploadedUrls: string[] = [];
      const errors: string[] = [];
      const total = driveFiles.length;

      try {
        for (let i = 0; i < driveFiles.length; i++) {
          const file = driveFiles[i];
          const progress = Math.round(((i + 1) / total) * 100);

          try {
            const buffer = await downloadDriveFile(file.id, apiKey);
            const ext = file.name.split(".").pop() || "jpg";
            const storagePath = `${event_slug}/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from("event-images")
              .upload(storagePath, buffer, { contentType: file.mimeType });

            if (uploadError) {
              errors.push(`${file.name}: ${uploadError.message}`);
            } else {
              const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(storagePath);
              uploadedUrls.push(urlData.publicUrl);
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
                status: `Processed ${i + 1}/${total} images...`,
              })}\n\n`
            )
          );
        }

        // Save uploaded URLs to photos table in batches
        if (uploadedUrls.length > 0) {
          const rows = uploadedUrls.map((path) => ({ event_id: event.id, path }));
          const { error: insertError } = await supabase.from("photos").insert(rows);
          if (insertError) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error: `Photos saved to storage but DB insert failed: ${insertError.message}`,
                })}\n\n`
              )
            );
            controller.close();
            return;
          }
        }

        // Send final result
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              complete: true,
              count: uploadedUrls.length,
              skipped: errors.length,
              errors: errors.length > 0 ? errors : undefined,
            })}\n\n`
          )
        );
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
