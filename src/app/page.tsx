// src/app/page.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

import Navbar from '@/components/Navbar'
import EventCardBasic from '@/components/EventCardBasic'
import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Home() {
  const [currentBg, setCurrentBg] = useState('/images/hero.jpg')
  const [events, setEvents] = useState<Array<{ id: number; slug: string; name: string; description: string; cover_url: string; bg_url?: string | null }>>([])
  const eventsRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: eventsRef,
    offset: ["start end", "end start"]
  })
  const cardsRef = useRef<HTMLDivElement>(null)

  // This creates the PERFECT black fade when scrolling down
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0, 1])
  const eventBgOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1])

  const scrollToEvents = () => {
    cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (window.location.hash === '#events') {
      setTimeout(() => scrollToEvents(), 50)
    }
  }, [])

  useEffect(() => {
    const sanitize = (u?: string | null) => (u || '').trim().replace(/\)+$/, '');
    async function fetchEvents() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, slug, title, description, starts_at, cover_url')
          .order('id', { ascending: true })
        
        if (error) {
          console.error('Failed to fetch events:', error.message)
          return
        }
        
        const mappedEvents = (data || []).map((ev: any) => {
          const cover = sanitize(ev.cover_url);
          return {
            id: ev.id,
            slug: ev.slug,
            name: ev.title,
            description: ev.description,
            cover_url: cover,
            bg_url: cover || null
          }
        })
        setEvents(mappedEvents)
        // Default to hero image since bg_url column no longer exists in schema
        setCurrentBg('/images/hero.jpg')
      } catch (err) {
        console.error('Error fetching events:', err)
      }
    }
    fetchEvents()
  }, [])

  return (
    <>
      <Navbar onEventsClick={scrollToEvents} onHomeClick={scrollToTop} />

      {/* HERO BACKGROUND — always visible */}
      <div className="fixed inset-0 -z-20">
        <Image src="/images/hero.jpg" alt="Hero" fill priority className="object-cover" />
      </div>

      {/* EVENT BACKGROUND — appears only when scrolled */}
      <motion.div
        style={{ opacity: eventBgOpacity }}
        className="fixed inset-0 -z-10"
      >
        <Image src={currentBg} alt="Event" fill className="object-cover" />
      </motion.div>

      {/* BLACK FADE OVERLAY — perfectly synced with scroll */}
      <motion.div
        style={{ opacity: overlayOpacity }}
        className="fixed inset-0 -z-10 bg-black"
      />

      {/* HERO — NO ANIMATION ON TEXT */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="mb-4 text-6xl md:text-8xl lg:text-8xl font-black text-white drop-shadow-2xl tracking-tighter">
          THE FILM & MEDIA CLUB
        </h1>
        <p className="mb-10 text-2xl md:text-4xl text-white/90 font-medium drop-shadow-lg">
          RAJIV GANDHI INSTITUTE OF PETROLEUM TECHNOLOGY
        </p>
        <button 
          onClick={scrollToEvents}
          className="group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-8 py-2 text-neutral-50 ;
          "
        >
          <span className="relative z-10">Explore Events</span>
          <span className="absolute inset-0 overflow-hidden rounded-md">
            <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
          </span>
        </button>
      </section>

      {/* EVENTS SECTION */}
      <section id="events" ref={eventsRef} className="relative py-32">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-center text-8xl md:text-9xl font-black text-white mb-20">Our Events</h2>
          <Link
            href="/admin"
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-40 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/25 text-white font-semibold backdrop-blur shadow-lg hover:bg-white/20 hover:-translate-y-0.5 hover:shadow-xl transition"
          >
            <span className="text-lg">＋</span>
            <span>Add Event</span>
          </Link>
          <div ref={cardsRef} className="relative mt-8 h-[68vh] md:h-[70vh] flex items-center justify-center">
            <Swiper
              modules={[Navigation]}
              spaceBetween={24}
              slidesPerView={1}
              centeredSlides
              navigation={{ prevEl: '.prev', nextEl: '.next' }}
              className="h-auto overflow-visible"
              onSlideChange={(s) => {
                const sanitize = (u?: string | null) => (u || '').trim().replace(/\)+$/, '');
                const bg = sanitize(events[s.activeIndex]?.bg_url) || '/images/hero.jpg'
                setCurrentBg(bg)
              }}
            >
              {events.map((ev) => (
                <SwiperSlide key={ev.id}>
                <EventCardBasic event={{ slug: ev.slug, title: ev.name || '', description: ev.description || '', cover_url: ev.cover_url }} />
              </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <button className="prev fixed left-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition">
            <svg
              viewBox="0 0 128 128"
              aria-hidden="true"
              className="w-8 h-8 fill-white/90"
            >
              <path d="M64 .3C28.7.3 0 28.8 0 64s28.7 63.7 64 63.7 64-28.5 64-63.7S99.3.3 64 .3zm0 121C32.2 121.3 6.4 95.7 6.4 64 6.4 32.3 32.2 6.7 64 6.7s57.6 25.7 57.6 57.3c0 31.7-25.8 57.3-57.6 57.3zm1.3-82.8L41.6 64l23.6 25.5h13.5L54.4 64l24.4-25.5H65.3z" />
            </svg>
          </button>
          <button className="next fixed right-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition">
            <svg
              viewBox="0 0 128 128"
              aria-hidden="true"
              className="w-8 h-8 fill-white/90"
            >
              <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm0 121.6C32.2 121.6 6.4 95.8 6.4 64S32.2 6.4 64 6.4s57.6 25.8 57.6 57.6-25.8 57.6-57.6 57.6zM49.2 38.4 73.6 64 49.2 89.6h13.5L86.4 64 62.7 38.4H49.2z" />
            </svg>
          </button>
        </div>
      </section>
    </>
  )
}
