// src/components/AddPhotoButton.tsx
"use client";

import { useState } from "react";

export default function AddPhotoButton({ eventSlug }: { eventSlug: string }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-4xl shadow-2xl hover:scale-110 transition-transform"
      >
        +
      </button>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="bg-gray-900 rounded-3xl p-10 max-w-lg w-full border border-white/20">
            <h3 className="text-3xl font-bold text-white mb-6">Add Photo to {eventSlug.toUpperCase()}</h3>
            <input
              type="file"
              accept="image/*"
              multiple
              className="block w-full text-white mb-6 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:bg-purple-600 file:text-white"
            />
            <div className="text-center text-gray-400 mb-6">OR</div>
            <input
              type="text"
              placeholder="Paste Google Drive folder link"
              className="w-full px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white mb-6"
            />
            <div className="flex gap-4">
              <button className="flex-1 py-4 bg-green-600 text-white rounded-full font-bold hover:bg-green-700">
                Upload
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-4 bg-gray-700 text-white rounded-full font-bold hover:bg-gray-600"
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