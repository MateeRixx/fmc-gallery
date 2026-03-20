"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

type PersonCard = {
  id: number;
  face_count: number;
  photo_count: number;
  event_count?: number;
  cover_url: string | null;
};

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPeople() {
      setLoading(true);
      setStatus("");
      try {
        const response = await fetch("/api/faces/people?limit=200");
        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) setStatus(data.error || "Failed to load people gallery");
          return;
        }

        if (!cancelled) {
          setPeople((data.people || []) as PersonCard[]);
        }
      } catch (error) {
        console.error("Failed to load people:", error);
        if (!cancelled) setStatus("Could not load people gallery.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPeople();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-28 pb-10 px-6 border-b border-white/10 bg-linear-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-black">People Search</h1>
          <p className="mt-4 text-gray-300 max-w-2xl">
            Browse automatically grouped faces across all events, similar to Google Photos people view.
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-6">
              <p className="text-sm text-gray-300">Loading detected people...</p>
            </div>
          ) : status ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
              <p className="text-sm text-red-200">{status}</p>
            </div>
          ) : people.length === 0 ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-6 space-y-3">
              <p className="text-sm text-gray-200">No people clusters yet.</p>
              <p className="text-xs text-gray-400">
                Upload face photos and run reclustering from Admin Face Tools to generate this gallery.
              </p>
              <Link
                href="/admin/faces"
                className="inline-block px-4 py-2 rounded-lg bg-[#FFBF00] text-black text-sm font-semibold"
              >
                Open Admin Face Tools
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {people.map((person) => (
                <Link
                  key={person.id}
                  href={`/people/${person.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-[#FFBF00] transition"
                >
                  <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5">
                    {person.cover_url ? (
                      <img
                        src={person.cover_url}
                        alt={`Person ${person.id}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-4xl opacity-20">👤</div>
                      </div>
                    )}
                  </div>

                  {/* Hover overlay with info */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-end justify-start p-3">
                    <div className="text-white">
                      <p className="text-xs font-semibold">{person.photo_count} photos</p>
                      <p className="text-[10px] text-gray-300">{person.face_count} detections</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
