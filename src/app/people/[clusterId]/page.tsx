"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import PhotoModal from "@/components/PhotoModal";
import { Permission } from "@/types";

type PersonPhoto = {
  photo_id: string;
  event_id: string;
  photo_url: string;
  event_slug: string | null;
  event_title: string | null;
  quality_score: number;
};

export default function PersonDetailPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params?.clusterId || "";
  const { data: session } = useSession();

  const [photos, setPhotos] = useState<PersonPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  // Photo modal state
  const [selectedPhoto, setSelectedPhoto] = useState<PersonPhoto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const canDelete = session?.user?.permissions?.includes(Permission.CAN_DELETE_PHOTOS) ||
                   session?.user?.role === 'head' || session?.user?.role === 'co_head';

  const loadPhotos = async () => {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch(`/api/faces/people/${clusterId}`);
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Failed to load person photos");
        return;
      }

      setPhotos((data.photos || []) as PersonPhoto[]);
    } catch (error) {
      console.error("Failed to load person photos:", error);
      setStatus("Could not load person photos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clusterId) {
      loadPhotos();
    }
  }, [clusterId]);

  const handlePhotoClick = (photo: PersonPhoto) => {
    setSelectedPhoto(photo);
    setModalOpen(true);
  };

  const handlePhotoDeleted = () => {
    // Refresh the photos list after successful deletion
    loadPhotos();
    setSelectedPhoto(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPhoto(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-28 pb-8 px-6 border-b border-white/10 bg-linear-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black">Person {clusterId}</h1>
            <div className="mt-3 flex items-center gap-4">
              <p className="text-gray-300">Matched photos across events: {photos.length}</p>
              {canDelete && (
                <span className="px-2 py-1 text-xs bg-red-500/20 text-red-300 rounded border border-red-500/30">
                  👑 Admin Mode - Can delete photos
                </span>
              )}
            </div>
          </div>
          <Link
            href="/people"
            className="px-4 py-2 rounded-lg border border-white/25 text-sm text-white hover:bg-white/10 transition"
          >
            Back To People
          </Link>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <p className="text-sm text-gray-300">Loading photos...</p>
          ) : status ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200 text-sm">
              {status}
            </div>
          ) : photos.length === 0 ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-gray-300">
              No photos found for this person cluster.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.photo_id}
                    className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-[#FFBF00] transition cursor-pointer"
                    onClick={() => handlePhotoClick(photo)}
                  >
                    <div className="aspect-square bg-white/5">
                      <img
                        src={photo.photo_url}
                        alt={`Person ${clusterId} match`}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                      />
                    </div>

                    {/* Hover overlay with event info and admin badge */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-3">
                      {/* Event title at bottom */}
                      {photo.event_slug && (
                        <div className="flex-1" />
                      )}
                      <div className="space-y-2">
                        {photo.event_slug && (
                          <p className="text-xs text-white font-medium">
                            {photo.event_title || photo.event_slug}
                          </p>
                        )}
                        {canDelete && (
                          <div className="flex items-center gap-1 text-[10px] text-red-300">
                            <span>🗑️</span>
                            <span>Click to view/delete</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quality score indicator */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                      <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                        Q: {(photo.quality_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Instruction text */}
              <div className="mt-6 text-center text-sm text-gray-400">
                Click any photo to view in full size{canDelete ? " or delete as admin" : ""}
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
          eventTitle={selectedPhoto.event_title}
          clusterId={clusterId}
          onPhotoDeleted={handlePhotoDeleted}
        />
      )}
    </div>
  );
}
