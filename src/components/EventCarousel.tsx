"use client";

import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import EventCardBasic from '@/components/EventCardBasic';
import { Event as GalleryEvent } from '@/types';

interface Props {
  events: GalleryEvent[];
  cardsRef: React.RefObject<HTMLDivElement>;
  onSlideChange: (bgUrl: string) => void;
}

export default function EventCarousel({ events, cardsRef, onSlideChange }: Props) {
  const sanitize = (u?: string | null) => (u || '').trim().replace(/\)+$/, '');

  return (
    <div ref={cardsRef} className="relative mt-8 h-[68vh] md:h-[70vh] flex items-center justify-center">
      <Swiper
        modules={[Navigation]}
        spaceBetween={24}
        slidesPerView={1}
        centeredSlides
        navigation={{ prevEl: '.prev', nextEl: '.next' }}
        className="h-auto overflow-visible"
        onSlideChange={(s) => {
          const ev = events[s.activeIndex];
          const bg = sanitize(ev?.hero_image_url || ev?.cover_url) || '/images/hero.jpg';
          onSlideChange(bg);
        }}
      >
        {events.map((ev, index) => (
          <SwiperSlide key={ev.id}>
            <EventCardBasic event={{ slug: ev.slug, title: ev.title || '', description: ev.description || '', cover_url: ev.cover_url, delay: index * 0.15 }} />
          </SwiperSlide>
        ))}
      </Swiper>

      <button className="prev fixed left-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition">
        <svg viewBox="0 0 128 128" aria-hidden="true" className="w-8 h-8 fill-white/90">
          <path d="M64 .3C28.7.3 0 28.8 0 64s28.7 63.7 64 63.7 64-28.5 64-63.7S99.3.3 64 .3zm0 121C32.2 121.3 6.4 95.7 6.4 64 6.4 32.3 32.2 6.7 64 6.7s57.6 25.7 57.6 57.3c0 31.7-25.8 57.3-57.6 57.3zm1.3-82.8L41.6 64l23.6 25.5h13.5L54.4 64l24.4-25.5H65.3z" />
        </svg>
      </button>
      <button className="next fixed right-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition">
        <svg viewBox="0 0 128 128" aria-hidden="true" className="w-8 h-8 fill-white/90">
          <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm0 121.6C32.2 121.6 6.4 95.8 6.4 64S32.2 6.4 64 6.4s57.6 25.8 57.6 57.6-25.8 57.6-57.6 57.6zM49.2 38.4 73.6 64 49.2 89.6h13.5L86.4 64 62.7 38.4H49.2z" />
        </svg>
      </button>
    </div>
  );
}
