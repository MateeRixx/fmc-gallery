"use client";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import AddPhotoButton from "@/components/AddPhotoButton";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Lightbox from "@/components/Lightbox";
import { useSession } from "next-auth/react";
import { Permission, UserRole } from "@/types";

export type EventData = {
  id: string;
  name: string;
  description: string;
  bgImage: string;
  images: readonly string[];
};

function GalleryImage({ src, alt, isSelected }: { src: string; alt: string; isSelected?: boolean }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      loading="lazy"
      unoptimized
      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
      onError={() => setVisible(false)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
    />
  );
}

export default function EventGalleryClient({ slug, event }: { slug: string; event: EventData }) {
  const { data: session } = useSession();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const galleryImages = event.images;

  // Check if user has permission to delete photos
  const canDelete = session?.user?.role === UserRole.HEAD || 
                   session?.user?.role === UserRole.CO_HEAD || 
                   session?.user?.permissions?.includes(Permission.CAN_DELETE_PHOTOS);

  useEffect(() => {
    setSelectedImages((prev) => {
      const filtered = new Set(Array.from(prev).filter((index) => index < galleryImages.length));
      return filtered;
    });
  }, [galleryImages.length]);

  const toggleImageSelection = (index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedImages(newSelected);
  };

  const enterSelectionAndSelect = (index: number) => {
    setIsSelectionMode(true);
    toggleImageSelection(index);
  };

  const handleImageMouseDown = (index: number) => {
    const timer = setTimeout(() => {
      enterSelectionAndSelect(index);
    }, 500);
    longPressTimers.current.set(index, timer);
  };

  const handleImageMouseUp = (index: number) => {
    const timer = longPressTimers.current.get(index);
    if (timer) clearTimeout(timer);
  };

  const handleImageDoubleClick = (index: number) => {
    const timer = longPressTimers.current.get(index);
    if (timer) clearTimeout(timer);
    enterSelectionAndSelect(index);
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === galleryImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(galleryImages.map((_, i) => i)));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedImages(new Set());
  };

  const downloadSingleImage = async (index: number) => {
    const imageUrl = galleryImages[index];
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${String(index + 1).padStart(3, "0")}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to download image ${index}:`, err);
      alert("Error downloading image. Please try again.");
    }
  };

  const downloadSelectedAsZip = async () => {
    if (selectedImages.size === 0) return;

    setIsDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder(event.name || "event-gallery");

      for (const index of Array.from(selectedImages).sort((a, b) => a - b)) {
        const imageUrl = galleryImages[index];
        if (!imageUrl) continue;

        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const filename = `image-${String(index + 1).padStart(3, "0")}.jpg`;
          folder?.file(filename, blob);
        } catch (err) {
          console.error(`Failed to download image ${index}:`, err);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.name || "gallery"}-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      exitSelectionMode();
    } catch (err) {
      console.error("Failed to create zip:", err);
      alert("Error downloading images. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteSelectedPhotos = async () => {
    if (selectedImages.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedImages.size} photo(s)? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const selectedUrls = Array.from(selectedImages).map(i => galleryImages[i]);
      
      const response = await fetch("/api/admin/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_paths: selectedUrls }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete photos");
      }

      alert("Successfully deleted!");
      // Reload page to get fresh photos from server and reset selected
      window.location.reload();
    } catch (err) {
      console.error("Failed to delete photos:", err);
      alert(`Error deleting photos: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Navbar />
      <AddPhotoButton eventSlug={slug} />
      <section className="relative min-h-[70vh] md:min-h-screen flex items-center justify-center text-center px-4 sm:px-6">
        <Image
          src={event.bgImage}
          alt={event.name}
          fill
          priority
          quality={75}
          unoptimized
          sizes="100vw"
          className="object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full max-w-5xl mx-auto">
          <h1 className="text-5xl sm:text-6xl md:text-9xl font-black text-white drop-shadow-2xl mb-4 md:mb-8">{event.name}</h1>
          <p className="text-base sm:text-lg md:text-2xl text-gray-200 leading-relaxed max-w-4xl mx-auto mb-6 md:mb-10 px-2">{event.description}</p>
        </div>
      </section>

      <Lightbox
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={galleryImages as string[]}
        currentIndex={lightboxIndex ?? 0}
        onNavigate={setLightboxIndex}
      />
      <section className="py-12 md:py-20 px-4 sm:px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 md:mb-12 gap-4 sm:gap-0">
            <h2 className="text-4xl md:text-5xl font-bold text-white">Gallery</h2>
            {galleryImages.length > 0 && (
              <div className="flex items-center gap-4">
                {!isSelectionMode ? (
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="text-white hover:[text:#FFBF00] transition text-sm underline cursor-pointer"
                  >
                    Download
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm rounded-full transition"
                    >
                      {selectedImages.size === galleryImages.length ? "Deselect All" : "Select All"}
                    </button>
                    {selectedImages.size > 0 && (
                      <button
                        onClick={downloadSelectedAsZip}
                        disabled={isDownloading || isDeleting}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-full transition font-semibold shadow-lg shadow-purple-500/30"
                      >
                        {isDownloading ? "Downloading..." : `Download (${selectedImages.size})`}
                      </button>
                    )}
                    {canDelete && selectedImages.size > 0 && (
                      <button
                        onClick={deleteSelectedPhotos}
                        disabled={isDeleting || isDownloading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-700 disabled:opacity-50 text-white text-sm rounded-full transition font-semibold shadow-lg shadow-red-500/30"
                      >
                        {isDeleting ? "Deleting..." : `Delete (${selectedImages.size})`}
                      </button>
                    )}
                    <button
                      onClick={exitSelectionMode}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm rounded-full transition"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:balance]">
            {galleryImages.map((src, i) => (
              <div
                key={i}
                className="mb-6 break-inside-avoid opacity-0 translate-y-6 animate-fadeIn"
                style={{ animationDelay: `${i * 0.15}s`, animationFillMode: "forwards" }}
              >
                <div
                  className="group relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300 hover:-translate-y-1 cursor-pointer select-none"
                  onClick={() => isSelectionMode ? toggleImageSelection(i) : setLightboxIndex(i)}
                  onMouseDown={() => handleImageMouseDown(i)}
                  onMouseUp={() => handleImageMouseUp(i)}
                  onMouseLeave={() => handleImageMouseUp(i)}
                  onDoubleClick={() => handleImageDoubleClick(i)}
                >
                  <div className="relative w-full h-full">
                    <GalleryImage
                      src={src}
                      alt={`${event.name} gallery ${i + 1}`}
                      isSelected={selectedImages.has(i)}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Selection checkbox - only in selection mode */}
                    {isSelectionMode && (
                      <div className="absolute top-4 left-4 z-10 opacity-100">
                        <input
                          type="checkbox"
                          checked={selectedImages.has(i)}
                          onChange={() => toggleImageSelection(i)}
                          className="w-6 h-6 cursor-pointer accent-purple-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    {/* Quick download button for single selected image */}
                    {selectedImages.has(i) && selectedImages.size === 1 && (
                      <div className="absolute bottom-4 right-4 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSingleImage(i);
                          }}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition font-semibold shadow-lg shadow-purple-500/30"
                        >
                          ↓ Download
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Lightbox
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={galleryImages as string[]}
        currentIndex={lightboxIndex ?? 0}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
