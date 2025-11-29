// src/app/about/page.tsx
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <Navbar />

      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/images/about_us_background.jpg"
          alt="About background"
          fill
          priority
          className="object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />
      </div>

      {/* Content */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-5xl mx-auto text-center space-y-16">
          <div>
            <h1
              style={{ fontFamily: "'Hepta Slab', serif'" }}
              className="text-7xl md:text-9xl font-black text-white drop-shadow-2xl"
            >
              ABOUT US
            </h1>
            <p className="mt-8 text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Where stories find their voice and frames breathe emotion. The RGIPT Film and Media Club is a creative sanctuary for storytellers, filmmakers, photographers, and editors who believe in the art of visual expression.
              We explore cinema not just as entertainment, but as a medium of thought, culture, and imagination.
              From script to screen, every project here is a collaboration of passion, perspective, and purpose — celebrating creativity in its truest form.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-10 justify-center items-center">
            <Link
              href="mailto:fmc@rgipt.ac.in"
              aria-label="Email FMC"
              className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-full hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-2xl"
            >
              <Image src="/icons/email.svg" alt="Email" width={32} height={32} />
            </Link>

            <Link
              href="https://www.instagram.com/fmcrgipt/"
              target="_blank"
              aria-label="Instagram FMC RGIPT"
              className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full hover:from-purple-700 hover:to-pink-700 hover:scale-105 transition-all duration-300 shadow-2xl"
            >
              <Image src="/icons/instagram.svg" alt="Instagram" width={32} height={32} />
            </Link>

            <Link
              href="https://www.youtube.com/channel/UCIWVbwolY5pQYrgsOKSK-tQ"
              target="_blank"
              aria-label="YouTube FMC RGIPT"
              className="flex items-center justify-center w-16 h-16 bg-red-600 rounded-full hover:bg-red-700 hover:scale-105 transition-all duration-300 shadow-2xl"
            >
              <Image src="/icons/youtube.svg" alt="YouTube" width={32} height={32} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}