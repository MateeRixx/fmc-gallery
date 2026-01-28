// src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { supabase } from "@/lib/supabase";
import { Event } from "@/types";

type EventFromDB = {
  id: number;
  slug: string;
  title: string;
  description: string;
  starts_at?: string;
  cover_url: string;
};

const ScrollBackground = dynamic(
  () => import("@/components/ScrollBackground"),
  { ssr: false },
);
const EventCarousel = dynamic(() => import("@/components/EventCarousel"), {
  ssr: false,
});

export default function Home() {
  const [currentBg, setCurrentBg] = useState("/images/hero.jpg");
  const [events, setEvents] = useState<Event[]>([]);
  const eventsRef = useRef<HTMLDivElement>(null!);
  const cardsRef = useRef<HTMLDivElement>(null!);

  const scrollToEvents = () => {
    cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (window.location.hash === "#events") {
      setTimeout(() => scrollToEvents(), 50);
    }
  }, []);

  useEffect(() => {
    const sanitize = (u?: string | null) =>
      (u || "").trim().replace(/\)+$/, "");
    async function fetchEvents() {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, slug, title, description, starts_at, cover_url")
          .order("id", { ascending: true });

        if (error) {
          console.error("Failed to fetch events:", error instanceof Error ? error.message : String(error));
          return;
        }

        const mappedEvents: Event[] = (data || []).map((ev: EventFromDB) => ({
          id: ev.id,
          slug: ev.slug,
          title: ev.title,
          description: ev.description,
          cover_url: sanitize(ev.cover_url),
          hero_image_url: null,
          starts_at: ev.starts_at,
        }));
        setEvents(mappedEvents);
        setCurrentBg("/images/hero.jpg");
      } catch (err) {
        console.error("Error fetching events:", err);
      }
    }
    fetchEvents();
  }, []);

  return (
    <>
      <Navbar onEventsClick={scrollToEvents} onHomeClick={scrollToTop} />

      {/* HERO BACKGROUND — always visible */}
      <div className="fixed inset-0 -z-20">
        <Image
          src="/images/hero.jpg"
          alt="Hero"
          fill
          priority
          quality={70}
          sizes="100vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect fill='%23111'/%3E%3C/svg%3E"
        />
      </div>

      {/* LAZY LOAD: Scroll animations and backgrounds */}
      <Suspense fallback={<div />}>
        <ScrollBackground eventsRef={eventsRef} currentBg={currentBg} />
      </Suspense>

      <HeroSection onExploreClick={scrollToEvents} />

      {/* EVENTS SECTION */}
      <section id="events" ref={eventsRef} className="relative py-32">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-center text-8xl md:text-9xl font-black text-white mb-20">
            Our Events
          </h2>
          <Link
            href="/admin"
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-40 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/25 text-white font-semibold backdrop-blur shadow-lg hover:bg-white/20 hover:-translate-y-0.5 hover:shadow-xl transition"
          >
            <span className="text-lg">＋</span>
            <span>Add Event</span>
          </Link>

          {/* LAZY LOAD: Event carousel with Swiper */}
          <Suspense
            fallback={
              <div className="h-[68vh] md:h-[70vh] flex items-center justify-center text-gray-400">
                Loading events...
              </div>
            }
          >
            <EventCarousel
              events={events}
              cardsRef={cardsRef}
              onSlideChange={setCurrentBg}
            />
          </Suspense>
        </div>
      </section>
    </>
  );
}
