"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";

type EventBasic = {
  slug: string;
  name: string;
  desc: string;
  cover: string;
};

export default function EventCardBasic({ event }: { event: EventBasic }) {
  return (
    <Link href={`/events/${event.slug}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4 }}
        viewport={{ once: true }}
        className="cursor-pointer w-[17.6rem] md:w-[22rem] mx-auto my-8 md:my-12 bg-white rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="relative aspect-[4/5]">
          <Image src={event.cover} alt={event.name} fill className="object-cover" />
        </div>
        <div className="px-4 py-4 text-center">
          <h3 className="font-ibarra text-xl md:text-2xl font-semibold text-black mb-2 uppercase tracking-wide h-12 overflow-hidden">
            {event.name}
          </h3>
          <p className="font-inter text-sm md:text-base text-gray-700 leading-relaxed h-16 overflow-hidden">
            {event.desc}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
