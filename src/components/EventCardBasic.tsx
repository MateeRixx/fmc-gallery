"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";

type EventBasic = {
  slug: string;
  title: string;
  description: string;
  starts_at?: string;
};

export default function EventCardBasic({ event }: { event: EventBasic }) {
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
            src="https://images.unsplash.com/photo-1726200290596-7e4fc55bb77d?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHxfA%3D%3D"
            alt={event?.title || "Event image"}
            fill
            className="object-cover"
          />
        </div>
        <div className="px-4 py-4 text-center">
          <h3 className="font-ibarra text-xl md:text-2xl font-semibold text-black mb-2 uppercase tracking-wide h-12 overflow-hidden">
            {event.title}
          </h3>
          <p className="font-inter text-sm md:text-base text-gray-700 leading-relaxed h-16 overflow-hidden">
            {event.description}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
