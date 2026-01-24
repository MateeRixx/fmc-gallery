"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { extractDominantColor, rgbToRgba, brightenColor } from "@/lib/colorExtractor";

type EventBasic = {
  slug: string;
  title: string;
  description: string;
  cover_url?: string | null;
  starts_at?: string;
  delay?: number;
};

const FALLBACK_IMG = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

export default function EventCardBasic({ event }: { event: EventBasic }) {
  const cover = (event.cover_url || "").trim() || FALLBACK_IMG;
  const [glowColor, setGlowColor] = useState('rgba(255,191,0,0.65)');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function getGlowColor() {
      const rgb = await extractDominantColor(cover);
      if (rgb) {
        const brightened = brightenColor(rgb, 1.1);
        setGlowColor(rgbToRgba(brightened, 0.85));
      }
    }
    getGlowColor();
  }, [cover]);
  return (
    <Link href={`/events/${event.slug}`} className="group block p-6 -m-6">
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1, delay: event.delay || 0, ease: "easeInOut" }}
        viewport={{ once: true }}
        className="cursor-pointer w-[17.6rem] md:w-88] mx-auto my-8 md:my-12 bg-white rounded-3xl overflow-hidden shadow-2xl transition-transform duration-200 group-hover:scale-[1.08]"
        style={{
          boxShadow: `0 2rem 3rem rgba(0,0,0,0.1)`,
        }}
        onHoverStart={() => {
          if (cardRef.current) {
            cardRef.current.style.boxShadow = `0 58px 180px -40px ${glowColor}`;
            cardRef.current.style.transition = `box-shadow 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`;
          }
        }}
        onHoverEnd={() => {
          if (cardRef.current) {
            cardRef.current.style.boxShadow = `0 2rem 3rem rgba(0,0,0,0.1)`;
            cardRef.current.style.transition = `box-shadow 0.3s ease-out`;
          }
        }}
      >
        <div className="relative aspect-4/5">
          <Image
            src={cover}
            alt={event?.title || "Event image"}
            fill
            sizes="(max-width: 768px) 17.6rem, 22rem"
            priority={false}
            className="object-cover"
          />
        </div>
        <div className="px-4 py-4 text-center">
          <h3 className="font-ibarra text-xl md:text-2xl font-semibold text-black mb-2 uppercase tracking-wide h-12 overflow-hidden">
            {event.title}
          </h3>
          <p
            className="font-inter text-sm md:text-base text-gray-700 leading-relaxed overflow-hidden min-h-17"
            style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
          >
            {event.description}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
