// src/app/page.tsx
'use client'

import Image from 'next/image'
import { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

import Navbar from '@/components/Navbar'
import EventCardBasic from '@/components/EventCardBasic'

const events = [
  { id: 1, slug: 'kaltarang', name: 'KALTARANG', desc: 'Annual cultural fest of RGIPT featuring dance, drama, music, and art competitions.', bg: '/images/bg-kaltarang.jpg', cover: '/images/kaltarang-cover.jpg' },
  { id: 2, slug: 'urjotsav', name: 'URJOTSAV', desc: 'The techno-management fest with innovation, workshops, and competitions.', bg: '/images/bg-urjotsav.jpg', cover: '/images/urjotsav-cover.jpg' },
  { id: 3, slug: 'energia', name: 'ENERGIA', desc: 'Annual sports meet with cricket, football, and athletics.', bg: '/images/bg-energia.jpg', cover: '/images/energia-cover.jpg' },
]

export default function Home() {
  const [currentBg, setCurrentBg] = useState('/images/hero.jpg')
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
        <h1 className="mb-4 text-6xl md:text-8xl lg:text-9xl font-black text-white drop-shadow-2xl tracking-tighter">
          THE FILM & MEDIA CLUB
        </h1>
        <p className="mb-10 text-2xl md:text-4xl text-white/90 font-medium drop-shadow-lg">
          RAJIV GANDHI INSTITUTE OF PETROLEUM TECHNOLOGY
        </p>
        <button
          onClick={scrollToEvents}
          className="rounded-full bg-white px-14 py-7 text-xl font-bold text-black shadow-2xl hover:scale-110 transition"
        >
          Explore Events
        </button>
      </section>

      {/* EVENTS SECTION */}
      <section id="events" ref={eventsRef} className="relative py-32">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-center text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-20">Our Events</h2>
          <div ref={cardsRef} className="relative mt-8 h-[68vh] md:h-[70vh] flex items-center justify-center">
            <Swiper
              modules={[Navigation]}
              spaceBetween={24}
              slidesPerView={1}
              centeredSlides
              navigation={{ prevEl: '.prev', nextEl: '.next' }}
              className="h-auto overflow-visible"
              onSlideChange={(s) => {
                setCurrentBg(events[s.activeIndex].bg)
              }}
            >
              {events.map((event) => (
                <SwiperSlide key={event.id}>
                <EventCardBasic event={{ slug: event.slug, name: event.name, desc: event.desc, cover: event.cover }} />
              </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <button className="prev fixed left-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition">
            <span className="text-4xl text-white">←</span>
          </button>
          <button className="next fixed right-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition">
            <span className="text-4xl text-white">→</span>
          </button>
        </div>
      </section>
    </>
  )
}
