"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";

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

  const [photos, setPhotos] = useState<PersonPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPhotos() {
      setLoading(true);
      setStatus("");

      try {
        const response = await fetch(`/api/faces/people/${clusterId}`);
        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) setStatus(data.error || "Failed to load person photos");
          return;
        }

        if (!cancelled) {
          setPhotos((data.photos || []) as PersonPhoto[]);
        }
      } catch (error) {
        console.error("Failed to load person photos:", error);
        if (!cancelled) setStatus("Could not load person photos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (clusterId) {
      loadPhotos();
    }

    return () => {
      cancelled = true;
    };
  }, [clusterId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-28 pb-8 px-6 border-b border-white/10 bg-linear-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black">Person {clusterId}</h1>
            <p className="mt-3 text-gray-300">Matched photos across events: {photos.length}</p>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.photo_id}
                  className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-[#FFBF00] transition cursor-pointer"
                >
                  <div className="aspect-square bg-white/5">
                    <img
                      src={photo.photo_url}
                      alt={`Person ${clusterId} match`}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                  </div>

                  {/* Hover overlay with event info */}
                  {photo.event_slug && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-end justify-start p-3">
                      <p className="text-xs text-white font-medium">
                        {photo.event_title || photo.event_slug}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
