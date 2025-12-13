// src/components/AddPhotoButton.tsx
"use client";

import { useState } from "react";

export default function AddPhotoButton({ eventSlug }: { eventSlug: string }) {
  const [showForm, setShowForm] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setStatus("Select images to upload");
      return;
    }
    setStatus("Uploading...");
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("dir", `gallery/${eventSlug}`);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        urls.push(json.url);
      }
      const ins = await fetch("/api/admin/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_slug: eventSlug, urls }),
      });
      const insJson = await ins.json();
      if (!ins.ok) throw new Error(insJson.error || "Save failed");
      setStatus("Uploaded");
      setFiles(null);
      setShowForm(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setStatus(`Error: ${msg}`);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-4xl shadow-2xl hover:scale-110 transition-transform"
      >
        +
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="bg-gray-900 rounded-3xl p-10 max-w-lg w-full border border-white/20">
            <h3 className="text-3xl font-bold text-white mb-6">Add Photo to {eventSlug.toUpperCase()}</h3>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="block w-full text-white mb-6 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:bg-purple-600 file:text-white"
            />
            <div className="flex gap-4">
              <button onClick={handleUpload} className="flex-1 py-4 bg-green-600 text-white rounded-full font-bold hover:bg-green-700">
                Upload
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-4 bg-gray-700 text-white rounded-full font-bold hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
            <p className="mt-4 text-center text-white">{status}</p>
          </div>
        </div>
      )}
    </>
  );
}
