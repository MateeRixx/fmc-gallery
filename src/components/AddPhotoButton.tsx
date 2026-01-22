// src/components/AddPhotoButton.tsx
"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression";

const SAVE_CHUNK = 25; // insert photos in batches to keep requests small

export default function AddPhotoButton({ eventSlug }: { eventSlug: string }) {
  const [showForm, setShowForm] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadViaApi(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dir", `${eventSlug}/photos`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Upload failed (${res.status})`);
    }
    const j = await res.json();
    if (!j?.url) throw new Error("Upload response missing url");
    return j.url as string;
  }

  async function saveBatch(urls: string[], eventSlug: string) {
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_slug: eventSlug, urls }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Failed to save photos");
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setStatus("Select images to upload");
      return;
    }
    setBusy(true);
    setStatus("Starting uploads...");

    try {
      const pending: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatus(`Compressing ${i + 1}/${files.length}...`);
        const compressed = await imageCompression(file, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        setStatus(`Uploading ${i + 1}/${files.length}...`);
        const url = await uploadViaApi(compressed);
        pending.push(url);

        if (pending.length >= SAVE_CHUNK) {
          setStatus(`Saving ${pending.length} photos...`);
          await saveBatch(pending.splice(0, pending.length), eventSlug);
        }
      }

      if (pending.length) {
        setStatus(`Saving ${pending.length} photos...`);
        await saveBatch(pending.splice(0, pending.length), eventSlug);
      }

      setStatus(`✓ Added ${files.length} photo(s) to gallery`);
      setFiles([]);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      console.error("Upload failed", err);
      setStatus(`✗ Error: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        title="Add photos to this event"
        className="fixed bottom-6 right-6 z-50 group w-14 h-14 rounded-lg bg-neutral-950 text-neutral-50 font-bold shadow-2xl flex items-center justify-center hover:shadow-[0_0_20px_rgba(255,191,0,0.3)] transition-all"
      >
        <span className="relative z-10 text-3xl leading-none">+</span>
        <span className="absolute inset-0 overflow-hidden rounded-lg">
          <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
        </span>
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-700 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Add Photos</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

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
              <p className="text-sm text-gray-300">{status || "Compresses to ~1.5MB, max 1920px. Uploads sequentially to avoid memory spikes."}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || busy}
                className="flex-1 group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 text-neutral-50 font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">{busy ? "Working..." : "Upload"}</span>
                <span className="absolute inset-0 overflow-hidden rounded-md">
                  <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
                </span>
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 text-neutral-50 font-bold py-3"
              >
                <span className="relative z-10">Cancel</span>
                <span className="absolute inset-0 overflow-hidden rounded-md">
                  <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
