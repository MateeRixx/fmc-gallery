// src/app/events/page.tsx

import { createClient } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import EventCard from "@/components/EventCard";
import { type Event } from "@/types";

// ISR: Revalidate every 1 hour (3600 seconds)
export const revalidate = 3600;

async function getEvents(): Promise<Event[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase configuration missing");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("events")
    .select("id, slug, title, description, cover_url, starts_at")
    .neq("slug", "profile-photos")
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return (data || []) as Event[];
}

export const metadata = {
  title: "Events - FMC Gallery",
  description: "Browse all events and their photos",
};

const sanitize = (u?: string | null) => (u || "").trim().replace(/\)+$/, "");

export default async function EventsPage() {
  const events = await getEvents();

  if (events.length === 0) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-4xl">No events yet — add one in /admin!</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-16 text-white">
            Our Events
          </h1>
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={{
                  id: event.id,
                  slug: event.slug,
                  name: event.title,
                  description: event.description,
                  coverImage: sanitize(event.cover_url),
                }}
                isActive={false}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
