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

        const result = await response.json();

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
        className="fixed bottom-8 right-8 z-40 w-16 h-16 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center text-3xl font-bold"
      >
        +
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
                className="flex-1 bg-linear-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
              <button 
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition border border-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}