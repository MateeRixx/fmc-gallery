"use client";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import AddPhotoButton from "@/components/AddPhotoButton";
import { useEffect, useRef, useState } from "react";

export type EventData = {
  id: string;
  name: string;
  description: string;
  bgImage: string;
  images: readonly string[];
};

type EventPerson = {
  id: number;
  face_count: number;
  photo_count: number;
  cover_url: string | null;
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
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [matchedPhotoUrls, setMatchedPhotoUrls] = useState<Set<string> | null>(null);
  const [eventPeople, setEventPeople] = useState<EventPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [peopleStatus, setPeopleStatus] = useState("");
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingPersonPhotos, setLoadingPersonPhotos] = useState(false);
  const longPressTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const galleryImages = matchedPhotoUrls
    ? event.images.filter((url) => matchedPhotoUrls.has(url))
    : event.images;

  useEffect(() => {
    setSelectedImages((prev) => {
      const filtered = new Set(Array.from(prev).filter((index) => index < galleryImages.length));
      return filtered;
    });
  }, [galleryImages.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadEventPeople() {
      if (!event.id) return;

      setLoadingPeople(true);
      setPeopleStatus("");
      try {
        const response = await fetch(`/api/faces/people?event_id=${encodeURIComponent(event.id)}&limit=120`);
        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) setPeopleStatus(data.error || "Failed to load people for this event");
          return;
        }

        if (!cancelled) {
          setEventPeople((data.people || []) as EventPerson[]);
        }
      } catch (error) {
        console.error("Failed to load event people:", error);
        if (!cancelled) setPeopleStatus("Failed to load people for this event.");
      } finally {
        if (!cancelled) setLoadingPeople(false);
      }
    }

    loadEventPeople();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  async function applyPersonFilter(personId: number) {
    setSelectedPersonId(personId);
    setLoadingPersonPhotos(true);
    try {
      const response = await fetch(
        `/api/faces/people/${personId}?event_id=${encodeURIComponent(event.id)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setPeopleStatus(data.error || "Failed to load person matches");
        return;
      }

      const urls = ((data.photos || []) as Array<{ photo_url: string }>).map((row) => row.photo_url);
      setMatchedPhotoUrls(new Set(urls));
      setIsSelectionMode(false);
      setSelectedImages(new Set());
      setPeopleStatus(urls.length ? "" : "No matched photos for this person in this event.");
    } catch (error) {
      console.error("Failed to apply person filter:", error);
      setPeopleStatus("Failed to apply person filter.");
    } finally {
      setLoadingPersonPhotos(false);
    }
  }

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
  return (
    <>
      <Navbar />
      <AddPhotoButton eventSlug={slug} />
      <section className="relative min-h-screen flex items-center justify-center text-center px-6">
        <Image 
          src={event.bgImage} 
          alt={event.name} 
          fill 
          priority 
          quality={75}
          sizes="100vw"
          className="object-cover brightness-50" 
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 max-w-5xl">
          <h1 className="text-6xl md:text-9xl font-black text-white drop-shadow-2xl mb-8">{event.name}</h1>
          <p className="text-lg md:text-2xl text-gray-200 leading-relaxed max-w-4xl mx-auto">{event.description}</p>
        </div>
      </section>
      <section className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6">
            <h3 className="text-2xl font-bold text-white">People In This Event</h3>
            <p className="text-sm text-gray-300 mt-1">
              Select a detected person to filter this event gallery.
            </p>

            {loadingPeople ? (
              <p className="mt-4 text-sm text-gray-300">Loading people clusters...</p>
            ) : eventPeople.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No people detected yet for this event. Upload face photos and run reclustering.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                {eventPeople.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => applyPersonFilter(person.id)}
                    disabled={loadingPersonPhotos}
                    className={`rounded-xl overflow-hidden border transition ${
                      selectedPersonId === person.id
                        ? "border-[#FFBF00] bg-[#FFBF00]/10"
                        : "border-white/20 bg-black/30 hover:border-white/40"
                    }`}
                    title={`Person ${person.id}`}
                  >
                    <div className="aspect-square bg-white/5">
                      {person.cover_url ? (
                        <img src={person.cover_url} alt={`Person ${person.id}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No cover</div>
                      )}
                    </div>
                    <div className="px-2 py-1 text-[10px] text-gray-200">{person.photo_count} photo(s)</div>
                  </button>
                ))}
              </div>
            )}

            {peopleStatus && <p className="mt-3 text-xs text-yellow-200">{peopleStatus}</p>}
          </div>

          {matchedPhotoUrls && (
            <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-[#FFBF00]/40 bg-[#FFBF00]/10 p-4">
              <p className="text-sm text-yellow-200">
                Showing {galleryImages.length} matched image(s) in this event.
              </p>
              <button
                onClick={() => {
                  setMatchedPhotoUrls(null);
                  setSelectedPersonId(null);
                  setPeopleStatus("");
                }}
                className="px-4 py-2 rounded-md border border-white/30 text-sm text-white hover:bg-white/10 transition"
              >
                Clear Face Filter
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-12">
            <h2 className="text-5xl font-bold text-white">Gallery</h2>
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
            {galleryImages.map((src, i) => (
              <div
                key={i}
                className="mb-6 break-inside-avoid opacity-0 translate-y-6 animate-fadeIn"
                style={{ animationDelay: `${i * 0.15}s`, animationFillMode: "forwards" }}
              >
                <div
                  className="group relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300 hover:-translate-y-1 cursor-pointer select-none"
                  onClick={() => isSelectionMode && toggleImageSelection(i)}
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
    </>
  );
}
