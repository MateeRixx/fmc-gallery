// src/app/events/page.tsx
'use client'; // Enables client-side features like Swiper

import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// Import your new components (we'll create them next)
import Navbar from '@/components/Navbar';
import EventCard from '@/components/EventCard';

// Dummy events data (replace with Supabase on Day 3)
const dummyEvents = [
  {
    id: 1,
    slug: 'kaltarang',
    name: 'Kaltarang',
    description: 'NITF Cultural Fest',
    coverImage: '/images/kaltarang-cover.jpg', // Add your Figma card image here
    year: 2024,
  },
  {
    id: 2,
    slug: 'urjotsav',
    name: 'Urjotsav',
    description: 'NITF Technical Fest',
    coverImage: '/images/urjotsav-cover.jpg',
    year: 2024,
  },
  {
    id: 3,
    slug: 'energia',
    name: 'Energia',
    description: 'Sports Day of NITF',
    coverImage: '/images/energia-cover.jpg',
    year: 2024,
  },
];

export default function EventsPage() {
  const [activeEvent, setActiveEvent] = useState(dummyEvents[0]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white py-20">
        {/* Title Section - Matches Figma centering */}
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-16 bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Our Events
          </h1>
        </div>

        {/* Swipeable Cards - Exact Figma horizontal layout */}
        <div className="max-w-7xl mx-auto px-6">
          <Swiper
            modules={[Navigation, Pagination]}
            spaceBetween={30}
            slidesPerView={1.2}
            centeredSlides={true}
            grabCursor={true}
            pagination={{ clickable: true }}
            navigation={true}
            onSlideChange={(swiper) => setActiveEvent(dummyEvents[swiper.activeIndex])}
            breakpoints={{
              640: { slidesPerView: 2.2 },
              1024: { slidesPerView: 3.2 },
            }}
            className="event-swiper"
          >
            {dummyEvents.map((event) => (
              <SwiperSlide key={event.id}>
                <EventCard event={event} isActive={activeEvent.id === event.id} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </>
  );
}