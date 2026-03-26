"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/jwt";
import { Permission } from "@/types";

type PhotoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  photoId: string;
  eventTitle?: string | null;
  clusterId?: string;
  onPhotoDeleted?: () => void;
};

export default function PhotoModal({
  isOpen,
  onClose,
  photoUrl,
  photoId,
  eventTitle,
  clusterId,
  onPhotoDeleted,
}: PhotoModalProps) {
  const [user] = useState(getCurrentUser());
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState("");

  const canDelete = user?.permissions?.includes(Permission.CAN_DELETE_PHOTOS) ||
                   user?.role === 'head' || user?.role === 'co_head';

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scroll
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleDelete = async () => {
    if (!canDelete || deleting) return;

    const confirmDelete = confirm(
      `Are you sure you want to delete this photo? This action cannot be undone.\n\nPhoto ID: ${photoId}${
        eventTitle ? `\nEvent: ${eventTitle}` : ""
      }`
    );

    if (!confirmDelete) return;

    setDeleting(true);
    setDeleteStatus("Deleting photo...");

    try {
      const token = localStorage.getItem("fmc-auth-token") || "";
      const response = await fetch("/api/admin/photos", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          photo_id: photoId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteStatus(`Delete failed: ${data.error || "Unknown error"}`);
        return;
      }

      setDeleteStatus("✓ Photo deleted successfully");

      // Give user time to see success message, then close and notify parent
      setTimeout(() => {
        onClose();
        onPhotoDeleted?.();
        setDeleteStatus("");
      }, 1500);

    } catch (error) {
      console.error("Delete photo failed:", error);
      setDeleteStatus("Delete failed due to network error");
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="relative max-w-7xl max-h-[90vh] w-full bg-black/80 rounded-2xl border border-white/20 overflow-hidden">

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold">
              {eventTitle ? `Photo from ${eventTitle}` : "Photo"}
            </h3>
            {clusterId && (
              <span className="text-xs text-gray-400 px-2 py-1 rounded bg-white/10">
                Person {clusterId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition"
              >
                {deleting ? "Deleting..." : "🗑️ Delete"}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Photo */}
        <div className="flex items-center justify-center h-full min-h-[400px] max-h-[90vh] p-4">
          <img
            src={photoUrl}
            alt="Photo preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
          />
        </div>

        {/* Footer with status */}
        {deleteStatus && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className={`text-sm text-center ${
              deleteStatus.startsWith("✓") ? "text-green-400" :
              deleteStatus.includes("failed") || deleteStatus.includes("error") ? "text-red-400" :
              "text-yellow-400"
            }`}>
              {deleteStatus}
            </p>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}