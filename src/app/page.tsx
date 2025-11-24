// src/app/page.tsx
import Image from 'next/image'
import Navbar from '@/components/Navbar'   // ← ADD THIS IMPORT

export default function Home() {
  return (
    <>
      {/* Navbar – Fixed at the top, glassmorphism effect */}
      <Navbar />

      {/* Hero Section */}
      <div className="relative min-h-screen bg-black overflow-hidden">
        {/* Background Image */}
        <Image
          src="/images/hero.jpg"          // ← Your real campus photo
          alt="Campus aerial view"
          fill
          priority
          className="object-cover brightness-[0.4]"
        />

        {/* Dark overlay + gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

        {/* Main Content */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="mb-6 bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-6xl font-black tracking-tighter text-transparent md:text-8xl lg:text-9xl">
            THE FILM & MEDIA CLUB
          </h1>
          <p className="mb-12 max-w-3xl text-lg text-gray-300 md:text-2xl">
            Capturing moments that matter. One frame at a time.
          </p>
          <button className="rounded-full bg-white px-12 py-6 text-xl font-bold text-black transition-all hover:scale-105 hover:bg-gray-100">
            Explore Gallery →
          </button>
        </div>
      </div>
    </>
  )
}