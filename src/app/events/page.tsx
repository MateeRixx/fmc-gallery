// src/app/events/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import Navbar from "@/components/Navbar";
import EventCard from "@/components/EventCard";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Event = {
  id: number;
  slug: string;
  name: string;
  description: string;
  cover_url: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const sanitize = (u?: string | null) => (u || '').trim().replace(/\)+$/, '');

  useEffect(() => {
    async function fetchEvents() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setConfigError("Supabase is not configured");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, description, starts_at")
        .order("id", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
      } else {
        setEvents(data || []);
        if (data && data.length > 0) {
          setActiveEvent(data[0]);
        }
      }
      setLoading(false);
    }

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-3xl">Loading events...</p>
        </div>
      </>
    );
  }

  if (configError) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-3xl">{configError}</p>
        </div>
      </>
    );
  }

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
        {/* Title */}
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-16 text-white">
            Our Events
          </h1>
        </div>

        {/* Swiper Gallery */}
        <div className="max-w-7xl mx-auto px-6">
          <Swiper
            modules={[Navigation, Pagination]}
            spaceBetween={30}
            slidesPerView={1.2}
            centeredSlides={true}
            grabCursor={true}
            pagination={{ clickable: true }}
            navigation={true}
            breakpoints={{
              640: { slidesPerView: 2.2 },
              1024: { slidesPerView: 3.2 },
            }}
            onSlideChange={(swiper) => setActiveEvent(events[swiper.activeIndex])}
            className="event-swiper"
          >
            {events.map((event) => (
              <SwiperSlide key={event.id}>
                <EventCard
                  event={{
                    id: event.id,
                    slug: event.slug,
                    name: event.name,
                    description: event.description,
                    coverImage: sanitize(event.cover_url),
                  }}
                  isActive={activeEvent?.id === event.id}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </>
  );
}
