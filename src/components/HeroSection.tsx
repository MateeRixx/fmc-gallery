"use client";

import Image from 'next/image';
import { useRef } from 'react';

export default function HeroSection({ onExploreClick }: { onExploreClick: () => void }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 className="mb-4 text-6xl md:text-8xl lg:text-8xl font-black text-white drop-shadow-2xl tracking-tighter">
        THE FILM & MEDIA CLUB
      </h1>
      <p className="mb-10 text-2xl md:text-4xl text-white/90 font-medium drop-shadow-lg">
        RAJIV GANDHI INSTITUTE OF PETROLEUM TECHNOLOGY
      </p>
      <button 
        onClick={onExploreClick}
        className="group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-8 py-2 text-neutral-50"
      >
        <span className="relative z-10">Explore Events</span>
        <span className="absolute inset-0 overflow-hidden rounded-md">
          <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
        </span>
      </button>
    </section>
  );
}
