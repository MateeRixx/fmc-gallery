// src/components/AddPhotoButton.tsx (or wherever you have the upload form)
"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase";

export default function AddPhotoButton({ eventSlug }: { eventSlug: string }) {
  const [showForm, setShowForm] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (files.length === 0) return;
    setStatus("Compressing & uploading...");

    try {
      const uploadedUrls: string[] = [];

      for (const file of files) {
        // COMPRESS HERE
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,               // Max 1MB
          maxWidthOrHeight: 1920,     // Max dimension
          useWebWorker: true,         // No UI freeze
          fileType: "image/jpeg",     // Better compression
        });

        const filePath = `${eventSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("event-images")
          .upload(filePath, compressedFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data } = supabase.storage.from("event-images").getPublicUrl(filePath);
        const publicUrl = data.publicUrl;
        console.log("Uploaded file URL:", publicUrl);
        uploadedUrls.push(publicUrl);
      }

      setStatus("Saving to gallery...");

      // Save URLs via API endpoint (uses service role key, bypasses RLS)
      for (const url of uploadedUrls) {
        const response = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_slug: eventSlug, url }),
        });

        let result;
        try {
          result = await response.json();
        } catch {
          console.error("Invalid JSON response from server");
          throw new Error(`Database error: Invalid response from server`);
        }

        if (!response.ok) {
          console.error("Failed to save photo URL:", result.error);
          throw new Error(`Database error: ${result.error}`);
        }
        console.log("Photo saved:", result.data);
      }

      setStatus(`✓ Success! ${files.length} photo(s) added to gallery!`);
      setFiles([]);

      // Wait 2 seconds then reload to ensure database is updated
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setStatus(`✗ Error: ${err.message}`);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowForm(true)} 
        className="fixed bottom-8 right-8 z-40 group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-8 py-2 text-neutral-50 font-bold text-lg shadow-2xl flex items-center justify-center"
      >
        <span className="relative z-10">+ Add Photos</span>
        <span className="absolute inset-0 overflow-hidden rounded-md">
          <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:-translate-x-0 group-hover:scale-150"></span>
        </span>
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Add Photos</h2>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-3 font-semibold">Select Images</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              />
              {files.length > 0 && (
                <p className="text-sm text-purple-400 mt-2">{files.length} file(s) selected</p>
              )}
            </div>

            <div className="mb-4 p-4 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-400">
                {status || "Compress automatically to max 1MB • JPEG format"}
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleUpload}
                disabled={files.length === 0}
                className="flex-1 group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 text-neutral-50 font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">Upload</span>
                <span className="absolute inset-0 overflow-hidden rounded-md">
                  <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:-translate-x-0 group-hover:scale-150"></span>
                </span>
              </button>
              <button 
                onClick={() => setShowForm(false)}
                className="flex-1 group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 text-neutral-50 font-bold py-3"
              >
                <span className="relative z-10">Cancel</span>
                <span className="absolute inset-0 overflow-hidden rounded-md">
                  <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:-translate-x-0 group-hover:scale-150"></span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}