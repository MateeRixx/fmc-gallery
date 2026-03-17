// src/components/AddPhotoButton.tsx
"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression";
import { getCurrentUser } from "@/lib/jwt";
import { Permission, UserRole } from "@/types";

const SAVE_CHUNK = 25;

export default function AddPhotoButton({ eventSlug }: { eventSlug: string }) {
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

  // ── Device upload helpers ────────────────────────────────────────────────

  async function uploadViaApi(file: File) {
    const token = localStorage.getItem("fmc-auth-token") || "";
    if (!token) throw new Error("Unauthorized. Please log in again.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dir", `${eventSlug}/photos`);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
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

  async function saveBatch(urls: string[], slug: string) {
    const token = localStorage.getItem("fmc-auth-token") || "";
    if (!token) throw new Error("Unauthorized. Please log in again.");
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event_slug: slug, urls }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Failed to save photos");
  }

  const handleUpload = async () => {
    if (files.length === 0) { setStatus("Select images to upload"); return; }
    const user = getCurrentUser();
    if (!user) { setStatus("Unauthorized. Please log in again."); return; }
    const isSupreme = user.role === UserRole.HEAD || user.role === UserRole.CO_HEAD;
    if (!isSupreme && !user.permissions?.includes(Permission.CAN_UPLOAD_PHOTOS)) {
      setStatus("You don't have permission to upload photos.");
      return;
    }
    setBusy(true);
    setStatus("Starting uploads...");
    try {
      const pending: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setStatus(`Compressing ${i + 1}/${files.length}...`);
        const compressed = await imageCompression(files[i], {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        setStatus(`Uploading ${i + 1}/${files.length}...`);
        pending.push(await uploadViaApi(compressed));
        if (pending.length >= SAVE_CHUNK) {
          setStatus(`Saving ${pending.length} photos...`);
          await saveBatch(pending.splice(0), eventSlug);
        }
      }
      if (pending.length) {
        setStatus(`Saving ${pending.length} photos...`);
        await saveBatch(pending.splice(0), eventSlug);
      }
      setStatus(`✓ Added ${files.length} photo(s) to gallery`);
      setFiles([]);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
      setStatus(`✗ Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Drive import helper ──────────────────────────────────────────────────

  const handleDriveImport = async () => {
    if (!driveUrl.trim()) { setDriveStatus("Paste a Google Drive folder link first."); return; }
    const token = localStorage.getItem("fmc-auth-token") || "";
    if (!token) { setDriveStatus("Unauthorized. Please log in again."); return; }

    setDriveBusy(true);
    setDriveStatus("Connecting to Google Drive...");
    try {
      const res = await fetch("/api/admin/import-from-drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folder_url: driveUrl.trim(), event_slug: eventSlug }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDriveStatus(`✗ ${j.error || "Import failed"}`);
        return;
      }
      const skippedNote = j.skipped > 0 ? ` (${j.skipped} skipped)` : "";
      setDriveStatus(`✓ Imported ${j.count} photo(s)${skippedNote}`);
      setDriveUrl("");
      setTimeout(() => window.location.reload(), 1500);
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-700 space-y-6">

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
