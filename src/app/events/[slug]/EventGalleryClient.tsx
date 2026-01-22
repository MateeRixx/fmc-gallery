"use client";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import AddPhotoButton from "@/components/AddPhotoButton";
import { useEffect, useState } from "react";
import JSZip from "jszip";

export type EventData = {
  name: string;
  description: string;
  bgImage: string;
  images: readonly string[];
};

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      onError={() => setVisible(false)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
    />
  );
}

export default function EventGalleryClient({ slug, event, testMode }: { slug: string; event: EventData; testMode: boolean }) {
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleImageSelection = (index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedImages(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === event.images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(event.images.map((_, i) => i)));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedImages(new Set());
  };

  const downloadSelectedAsZip = async () => {
    if (selectedImages.size === 0) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(event.name || "event-gallery");

      let downloaded = 0;
      for (const index of Array.from(selectedImages).sort((a, b) => a - b)) {
        const imageUrl = event.images[index];
        if (!imageUrl) continue;

        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const filename = `image-${String(index + 1).padStart(3, "0")}.jpg`;
          folder?.file(filename, blob);
          downloaded++;
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
  return (
    <>
      <Navbar />
      <AddPhotoButton eventSlug={slug} />
      <section className="relative min-h-screen flex items-center justify-center text-center px-6">
        <Image src={event.bgImage} alt={event.name} fill priority className="object-cover brightness-50" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 max-w-5xl">
          <h1 className="text-6xl md:text-9xl font-black text-white drop-shadow-2xl mb-8">{event.name}</h1>
          <p className="text-lg md:text-2xl text-gray-200 leading-relaxed max-w-4xl mx-auto">{event.description}</p>
        </div>
      </section>
      <section className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-5xl font-bold text-white">Gallery</h2>
            {event.images.length > 0 && (
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
                      {selectedImages.size === event.images.length ? "Deselect All" : "Select All"}
                    </button>
                    {selectedImages.size > 0 && (
                      <button
                        onClick={downloadSelectedAsZip}
                        disabled={isDownloading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-full transition font-semibold shadow-lg shadow-purple-500/30"
                      >
                        {isDownloading ? "Downloading..." : `Download (${selectedImages.size})`}
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
            {event.images.map((src, i) => (
              <div
                key={i}
                className="mb-6 break-inside-avoid opacity-0 translate-y-6 animate-fadeIn"
                style={{ animationDelay: `${i * 0.15}s`, animationFillMode: "forwards" }}
              >
                <div className="group relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300 hover:-translate-y-1 cursor-pointer" onClick={() => isSelectionMode && toggleImageSelection(i)}>
                  <div className="relative w-full h-full">
                    <GalleryImage src={src} alt={`${event.name} gallery ${i + 1}`} />
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
