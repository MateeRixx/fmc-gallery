// src/app/page.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import { createClient } from '@supabase/supabase-js'

const ScrollBackground = dynamic(() => import('@/components/ScrollBackground'), { ssr: false })
const EventCarousel = dynamic(() => import('@/components/EventCarousel'), { ssr: false })

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
  const eventsRef = useRef<HTMLDivElement>(null!)
  const cardsRef = useRef<HTMLDivElement>(null!)

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
        <Image 
          src="/images/hero.jpg" 
          alt="Hero" 
          fill 
          priority 
          quality={75}
          sizes="100vw"
          className="object-cover" 
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
          <h2 className="text-center text-8xl md:text-9xl font-black text-white mb-20">Our Events</h2>
          <Link
            href="/admin"
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-40 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/25 text-white font-semibold backdrop-blur shadow-lg hover:bg-white/20 hover:-translate-y-0.5 hover:shadow-xl transition"
          >
            <span className="text-lg">＋</span>
            <span>Add Event</span>
          </Link>
          
          {/* LAZY LOAD: Event carousel with Swiper */}
          <Suspense fallback={<div className="h-[68vh] md:h-[70vh] flex items-center justify-center text-gray-400">Loading events...</div>}>
            <EventCarousel events={events} cardsRef={cardsRef} onSlideChange={setCurrentBg} />
          </Suspense>
        </div>
      </section>
    </>
  )
}