"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import PhotoModal from "@/components/PhotoModal";
import { getCurrentUser } from "@/lib/jwt";
import { Permission } from "@/types";
import { supabase } from "@/lib/supabase";

type PersonPhoto = {
  photo_id: string;
  photo_url: string;
  quality_score?: number;
};

export default function ClusterPhotosPage({ params }: { params: Promise<{ slug: string; clusterId: string }> }) {
  const { slug, clusterId } = React.use(params);
  const [user] = useState(getCurrentUser());

  const [eventName, setEventName] = useState("");
  const [photos, setPhotos] = useState<PersonPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  // Photo modal state
  const [selectedPhoto, setSelectedPhoto] = useState<PersonPhoto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const canDelete = user?.permissions?.includes(Permission.CAN_DELETE_PHOTOS) ||
                   user?.role === 'head' || user?.role === 'co_head';

  const loadData = async () => {
    try {
      // Get event info
      const { data: ev } = await supabase
        .from("events")
        .select("id, title")
        .eq("slug", slug)
        .maybeSingle();

      if (ev) {
        setEventName(ev.title);
      }

      // Load photos for this person in this event
      const response = await fetch(`/api/faces/people/${clusterId}?event_id=${encodeURIComponent(ev?.id || "")}`);
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Failed to load photos");
        return;
      }

      setPhotos((data.photos || []) as PersonPhoto[]);
    } catch (error) {
      console.error("Failed to load:", error);
      setStatus("Could not load photos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug, clusterId]);

  const handlePhotoClick = (photo: PersonPhoto) => {
    setSelectedPhoto(photo);
    setModalOpen(true);
  };

  const handlePhotoDeleted = () => {
    // Refresh the photos list after successful deletion
    loadData();
    setSelectedPhoto(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPhoto(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-28 pb-10 px-6 border-b border-white/10 bg-gradient-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/events/${slug}/faces`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#FFBF00] transition mb-6"
          >
            <span>←</span> Back to Faces
          </Link>
          <h1 className="text-5xl md:text-6xl font-black">Photos of Person #{clusterId}</h1>
          <div className="mt-4 flex items-center gap-4">
            <p className="text-gray-300 max-w-2xl">
              Showing all photos from {eventName} containing this person.
            </p>
            {canDelete && (
              <span className="px-2 py-1 text-xs bg-red-500/20 text-red-300 rounded border border-red-500/30">
                👑 Admin Mode - Can delete photos
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-6">
              <p className="text-sm text-gray-300">Loading photos...</p>
            </div>
          ) : status ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
              <p className="text-sm text-red-200">{status}</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-6">
              <p className="text-sm text-gray-200">No photos found for this person in this event.</p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex items-center justify-between">
                <p className="text-gray-400">Found {photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
                {canDelete && (
                  <p className="text-xs text-red-300">Click any photo to view in full size or delete as admin</p>
                )}
              </div>
              <div className="columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:balance]">
                {photos.map((photo, i) => (
                  <div
                    key={photo.photo_id}
                    className="mb-6 break-inside-avoid opacity-0 translate-y-6 animate-fadeIn cursor-pointer"
                    style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
                    onClick={() => handlePhotoClick(photo)}
                  >
                    <div className="group relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300 hover:-translate-y-1">
                      <Image
                        src={photo.photo_url}
                        alt={`Photo ${i + 1}`}
                        width={800}
                        height={600}
                        loading="lazy"
                        unoptimized
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      {/* Admin indicators */}
                      {canDelete && (
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="flex items-center gap-1 text-xs bg-red-500/80 text-white px-2 py-1 rounded">
                            🗑️ Delete
                          </div>
                        </div>
                      )}

                      {/* Quality score */}
                      {photo.quality_score && (
                        <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="text-xs bg-black/70 text-white px-2 py-1 rounded">
                            Q: {(photo.quality_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Photo Modal */}
      {selectedPhoto && (
        <PhotoModal
          isOpen={modalOpen}
          onClose={closeModal}
          photoUrl={selectedPhoto.photo_url}
          photoId={selectedPhoto.photo_id}
          eventTitle={eventName}
          clusterId={clusterId}
          onPhotoDeleted={handlePhotoDeleted}
        />
      )}
    </div>
  );
}
