"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";

type EventBasic = {
  slug: string;
  title: string;
  description: string;
  cover_url?: string | null;
  starts_at?: string;
};

const FALLBACK_IMG = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

export default function EventCardBasic({ event }: { event: EventBasic }) {
  const cover = (event.cover_url || "").trim() || FALLBACK_IMG;
  return (
    <Link href={`/events/${event.slug}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4 }}
        viewport={{ once: true }}
        className="cursor-pointer w-[17.6rem] md:w-88] mx-auto my-8 md:my-12 bg-white rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="relative aspect-4/5">
          <Image
            src={cover}
            alt={event?.title || "Event image"}
            fill
            sizes="(max-width: 768px) 17.6rem, 22rem"
            quality={80}
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
