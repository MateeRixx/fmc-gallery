"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import FaceThumbnail from "@/components/faces/FaceThumbnail";
import { supabase } from "@/lib/supabase";

type EventPerson = {
  id: number;
  face_count: number;
  photo_count: number;
  cover_url: string | null;
  cover_face_bbox?: { x: number; y: number; width: number; height: number } | null;
};

export default function EventFacesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [people, setPeople] = useState<EventPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEventAndPeople() {
      try {
        // First get the event ID
        const { data: ev, error: evError } = await supabase
          .from("events")
          .select("id, title")
          .neq("slug", "profile-photos")
          .eq("slug", slug)
          .maybeSingle();

        if (evError) {
          console.error("Error fetching event:", evError);
          if (!cancelled) setStatus("Failed to load event");
          setLoading(false);
          return;
        }

        if (!ev) {
          if (!cancelled) setStatus("Event not found");
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setEventId(String(ev.id));
          setEventName(ev.title);
        }

        // Then load people for this event
        const response = await fetch(`/api/faces/people?event_id=${encodeURIComponent(ev.id)}&limit=200`);
        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) setStatus(data.error || "Failed to load people");
          return;
        }

        if (!cancelled) {
          setPeople((data.people || []) as EventPerson[]);
        }
      } catch (error) {
        console.error("Failed to load:", error);
        if (!cancelled) setStatus("Could not load face clusters.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEventAndPeople();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-28 pb-10 px-6 border-b border-white/10 bg-gradient-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/events/${slug}`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#FFBF00] transition mb-6"
          >
            <span>←</span> Back to {eventName || "Event"}
          </Link>
          <h1 className="text-5xl md:text-6xl font-black">People in {eventName}</h1>
          <p className="mt-4 text-gray-300 max-w-2xl">
            Browse faces detected in this event. Click on any person to see all their photos.
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-6">
              <p className="text-sm text-gray-300">Loading face clusters...</p>
            </div>
          ) : status ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
              <p className="text-sm text-red-200">{status}</p>
            </div>
          ) : people.length === 0 ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-6 space-y-3">
              <p className="text-sm text-gray-200">No people detected yet for this event.</p>
              <p className="text-xs text-gray-400">
                Upload face photos and run reclustering from Admin Face Tools to generate face clusters.
              </p>
              <Link
                href="/admin/faces"
                className="inline-block px-4 py-2 rounded-lg bg-[#FFBF00] text-black text-sm font-semibold hover:bg-[#e6ac00] transition"
              >
                Go to Admin Face Tools
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {people.map((person) => (
                <Link
                  key={person.id}
                  href={`/events/${slug}/faces/${person.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-[#FFBF00] transition"
                >
                  <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5">
                    <FaceThumbnail
                      photoUrl={person.cover_url || ""}
                      bbox={person.cover_face_bbox}
                      alt={`Person ${person.id}`}
                      className="group-hover:scale-110 transition duration-300"
                    />
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
