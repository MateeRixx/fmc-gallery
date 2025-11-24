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

const events = [
  { id: 1, name: 'KALTARANG', desc: 'Annual cultural fest of RGIPT featuring dance, drama, music, and art competitions.', bg: '/images/bg-kaltarang.jpg', cover: '/images/kaltarang-cover.jpg' },
  { id: 2, name: 'URJOTSAV', desc: 'The techno-management fest with innovation, workshops, and competitions.', bg: '/images/bg-urjotsav.jpg', cover: '/images/urjotsav-cover.jpg' },
  { id: 3, name: 'ENERGIA', desc: 'Annual sports meet with cricket, football, and athletics.', bg: '/images/bg-energia.jpg', cover: '/images/energia-cover.jpg' },
]

export default function Home() {
  const [currentBg, setCurrentBg] = useState('/images/hero.jpg')
  const eventsRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: eventsRef,
    offset: ["start end", "end start"]
  })

  // This creates the PERFECT black fade when scrolling down
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0, 1])
  const eventBgOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1])

  const scrollToEvents = () => {
    eventsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Navbar onEventsClick={scrollToEvents} />

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
        className="fixed inset-0 -z-5 bg-black"
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
      <section ref={eventsRef} className="relative min-h-screen py-32">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-center mb-24 text-6xl md:text-8xl font-black bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Our Events
          </h2>

          <Swiper
            modules={[Navigation]}
            spaceBetween={100}
            slidesPerView={1}
            centeredSlides
            navigation={{ prevEl: '.prev', nextEl: '.next' }}
            onSlideChange={(s) => {
              setCurrentBg(events[s.activeIndex].bg)
            }}
          >
            {events.map((event, i) => (
              <SwiperSlide key={event.id}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto items-center">
                  <motion.div
                    initial={{ opacity: 0, x: -100 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/10 shadow-2xl"
                  >
                    <h3 className="font-ibarra text-6xl font-semibold text-white mb-8">{event.name}</h3>
                    <p className="font-inter text-xl text-gray-300 leading-relaxed">{event.desc}</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 100 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="relative h-96 lg:h-full min-h-96 rounded-3xl overflow-hidden shadow-2xl"
                  >
                    <Image src={event.cover} alt={event.name} fill className="object-cover" />
                  </motion.div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          <button className="prev fixed left-10 top-1/2 -translate-y-1/2 z-50 w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition">
            <span className="text-4xl text-white">←</span>
          </button>
          <button className="next" className="next fixed right-10 top-1/2 -translate-y-1/2 z-50 w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition">
            <span className="text-4xl text-white">→</span>
          </button>
        </div>
      </section>
    </>
  )
}