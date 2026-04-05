// src/components/AddPhotoButton.tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Permission, UserRole } from "@/types";

const SAVE_CHUNK = 25;

type SavedPhoto = {
  id: string;
  event_id: string;
  path: string;
};

export default function AddPhotoButton({ eventSlug }: { eventSlug: string }) {  const router = useRouter();  const { data: session } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"device" | "drive">("device");

  // Device upload state
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Drive import state
  const [driveUrl, setDriveUrl] = useState("");
  const [driveStatus, setDriveStatus] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveProgress, setDriveProgress] = useState(0);

  // ── Device upload helpers ────────────────────────────────────────────────

  async function uploadViaApi(file: File) {
    // NextAuth handles session via HttpOnly cookies, no need for manual token
    if (!session?.user) throw new Error("Unauthorized. Please log in again.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dir", `${eventSlug}/photos`);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Upload failed (${res.status})`);
    }
    const j = await res.json();
    if (!j?.url) throw new Error("Upload response missing url");
    return j.url as string;
  }

  async function saveBatch(urls: string[], slug: string): Promise<SavedPhoto[]> {
    if (!session?.user) throw new Error("Unauthorized. Please log in again.");
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_slug: slug, urls }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Failed to save photos");
    return (j.photos || []) as SavedPhoto[];
  }

  async function indexFacesAws(photos: SavedPhoto[]) {
    if (!photos.length) return { indexedFaces: 0, failedPhotos: 0, newFaceIds: [] };

    if (!session?.user) throw new Error("Unauthorized. Please log in again.");

    const res = await fetch("/api/admin/faces/index-aws", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photos: photos.map((photo) => ({
          photo_id: photo.id,
          event_id: photo.event_id,
          image_url: photo.path,
        })),
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.error || "Failed to index faces");
    }

    return {
      indexedFaces: Number(j.indexed_faces || 0),
      failedPhotos: Number(j.failed_photos || 0),
      newFaceIds: (j.new_face_ids || []) as number[],
    };
  }

  async function mergeNewFacesIncremental(newFaceIds: number[]) {
    if (newFaceIds.length === 0) return { mergedCount: 0 };

    if (!session?.user) throw new Error("Unauthorized. Please log in again.");

    const res = await fetch("/api/admin/faces/recluster", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "incremental",
        new_face_ids: newFaceIds,
        threshold: 0.35,
        min_quality: 0.45,
        method: "aws",
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.error || "Failed to merge new faces");
    }

    return {
      mergedCount: Number(j.merged_faces || 0),
      unmatchedCount: Number(j.unmatched_faces || 0),
    };
  }

  async function fullRecluster() {
    if (!session?.user) throw new Error("Unauthorized. Please log in again.");

    const res = await fetch("/api/admin/faces/recluster", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "full",
        threshold: 0.35,
        min_quality: 0.45,
        method: "aws",
        reset: false,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.error || "Failed to refresh people clusters");
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) { setStatus("Select images to upload"); return; }
    if (!session?.user) { setStatus("Unauthorized. Please log in again."); return; }
    const isSupreme = session.user.role === UserRole.HEAD || session.user.role === UserRole.CO_HEAD;
    if (!isSupreme && !session.user.permissions?.includes(Permission.CAN_UPLOAD_PHOTOS)) {
      setStatus("You don't have permission to upload photos.");
      return;
    }
    setBusy(true);
    setStatus("Starting uploads...");
    try {
      const pending: string[] = [];
      let indexedFacesCount = 0;
      let indexingFailedPhotos = 0;
      const allNewFaceIds: number[] = [];

      for (let i = 0; i < files.length; i++) {
        setStatus(`Compressing ${i + 1}/${files.length}...`);
        const compressed = await imageCompression(files[i], {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        setStatus(`Uploading ${i + 1}/${files.length}...`);
        const url = await uploadViaApi(compressed);
        pending.push(url);

        if (pending.length >= SAVE_CHUNK) {
          setStatus(`Saving ${pending.length} photos...`);
          const saved = await saveBatch(pending.splice(0), eventSlug);
          setStatus(`AWS indexing ${saved.length} photo(s)...`);
          const indexStats = await indexFacesAws(saved);
          indexedFacesCount += indexStats.indexedFaces;
          indexingFailedPhotos += indexStats.failedPhotos;
          allNewFaceIds.push(...indexStats.newFaceIds);
        }
      }
      if (pending.length) {
        setStatus(`Saving ${pending.length} photos...`);
        const saved = await saveBatch(pending.splice(0), eventSlug);

        setStatus(`AWS indexing ${saved.length} photo(s)...`);
        const indexStats = await indexFacesAws(saved);
        indexedFacesCount += indexStats.indexedFaces;
        indexingFailedPhotos += indexStats.failedPhotos;
        allNewFaceIds.push(...indexStats.newFaceIds);
      }


      setStatus(
        `✓ Added ${files.length} photo(s). AWS indexed ${indexedFacesCount} face(s) with ${indexingFailedPhotos} photo indexing failures.`
      );
      setFiles([]);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      let msg = "Unknown error";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === "string") {
        msg = err;
      } else if (err && typeof err === "object") {
        msg = JSON.stringify(err);
      }
      setStatus(`✗ Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Drive import helper ──────────────────────────────────────────────────

  const handleDriveImport = async () => {
    if (!driveUrl.trim()) { setDriveStatus("Paste a Google Drive folder link first."); return; }
    if (!session?.user) { setDriveStatus("Unauthorized. Please log in again."); return; }

    setDriveBusy(true);
    setDriveProgress(0);
    setDriveStatus("Connecting to Google Drive...");
    try {
      const res = await fetch("/api/admin/import-from-drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_url: driveUrl.trim(), event_slug: eventSlug }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDriveStatus(`✗ ${j.error || "Import failed"}`);
        setDriveBusy(false);
        return;
      }

      // Handle SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                setDriveStatus(`✗ ${data.error}`);
                setDriveBusy(false);
                return;
              }

              if (data.complete) {
                const skippedNote = data.skipped > 0 ? ` (${data.skipped} skipped)` : "";
                setDriveStatus(`✓ Imported ${data.count} photo(s)${skippedNote}`);
                setDriveUrl("");
                setDriveProgress(100);
                setTimeout(() => window.location.reload(), 1500);
                return;
              }

              if (data.progress !== undefined) {
                setDriveProgress(data.progress);
                setDriveStatus(data.status || "Processing...");
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      setDriveStatus("✗ Stream ended unexpectedly");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
      setDriveStatus(`✗ Error: ${msg}`);
    } finally {
      setDriveBusy(false);
    }
  };

  // ── Shared button style ──────────────────────────────────────────────────

  const btnClass =
    "flex-1 group relative h-12 overflow-hidden rounded-md bg-neutral-950 text-neutral-50 font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed";
  const btnInner = (
    <span className="absolute inset-0 overflow-hidden rounded-md">
      <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150" />
    </span>
  );

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        title="Add photos to this event"
        className="fixed bottom-6 right-6 z-50 group w-14 h-14 rounded-lg bg-neutral-950 text-neutral-50 font-bold shadow-2xl flex items-center justify-center hover:shadow-[0_0_20px_rgba(255,191,0,0.3)] transition-all"
      >
        <span className="relative z-10 text-3xl leading-none">+</span>
        <span className="absolute inset-0 overflow-hidden rounded-lg">
          <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150" />
        </span>
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] p-6 sm:p-8 border border-gray-700 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Add Photos</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Tab toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              <button
                onClick={() => setTab("device")}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === "device" ? "bg-[#FFBF00] text-black" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                From Device
              </button>
              <button
                onClick={() => setTab("drive")}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === "drive" ? "bg-[#FFBF00] text-black" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                From Google Drive
              </button>
            </div>

            {/* Device upload tab */}
            {tab === "device" && (
              <>
                <div className="space-y-3">
                  <label className="block text-gray-300 font-semibold">Select images</label>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FFBF00] cursor-pointer"
                  />
                  {files.length > 0 && (
                    <p className="text-sm text-purple-400">{files.length} file(s) selected</p>
                  )}
                </div>
                <div className="p-4 bg-gray-800 rounded-lg min-h-12">
                  <p className="text-sm text-gray-300">
                    {status || "Compresses to ~1.5MB, max 1920px. Uploads sequentially to avoid memory spikes."}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleUpload} disabled={files.length === 0 || busy} className={btnClass}>
                    <span className="relative z-10">{busy ? "Working..." : "Upload"}</span>
                    {btnInner}
                  </button>
                  <button onClick={() => setShowForm(false)} className={btnClass}>
                    <span className="relative z-10">Cancel</span>
                    {btnInner}
                  </button>
                </div>
              </>
            )}

            {/* Google Drive tab */}
            {tab === "drive" && (
              <>
                <div className="space-y-3">
                  <label className="block text-gray-300 font-semibold">Google Drive folder link</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    disabled={driveBusy}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFBF00] disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500">
                    The folder must be shared as &quot;Anyone with the link can view&quot;. All PNG/JPEG files inside will be imported.
                  </p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg min-h-12">
                  <p className="text-sm text-gray-300">
                    {driveStatus || "Photos are downloaded server-side and stored in Supabase. Up to 300 images per import."}
                  </p>
                  {driveBusy && driveProgress > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-[#FFBF00] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${driveProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">{driveProgress}% complete</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleDriveImport} disabled={!driveUrl.trim() || driveBusy} className={btnClass}>
                    <span className="relative z-10">{driveBusy ? "Importing..." : "Import"}</span>
                    {btnInner}
                  </button>
                  <button onClick={() => setShowForm(false)} className={btnClass}>
                    <span className="relative z-10">Cancel</span>
                    {btnInner}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
