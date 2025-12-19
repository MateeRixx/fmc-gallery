"use client";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import AddPhotoButton from "@/components/AddPhotoButton";
import { useEffect, useState } from "react";

export type EventData = {
  name: string;
  description: string;
  bgImage: string;
  images: readonly string[];
};

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      onError={() => setVisible(false)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
    />
  );
}

function WeatherBadge({ testMode }: { testMode: boolean }) {
  const [rain, setRain] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (testMode) {
        if (!cancelled) {
          setRain(42);
          setLoading(false);
        }
        return;
      }
      try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=26.26&longitude=81.18&hourly=precipitation_probability&current_weather=true&timezone=auto";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const probs: number[] = data?.hourly?.precipitation_probability || [];
        const avg = probs.slice(0, 6).reduce((a: number, b: number) => a + b, 0) / Math.max(1, Math.min(6, probs.length || 1));
        if (!cancelled) {
          setRain(Math.round(avg));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRain(null);
          setLoading(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [testMode]);
  return (
    <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-white/10 px-6 py-3 text-white">
      <span className="text-sm font-semibold">Weather</span>
      <span className="text-sm">{loading ? "Checking…" : rain !== null ? `Rain chance: ${rain}%` : "No data"}</span>
    </div>
  );
}

export default function EventGalleryClient({ slug, event, testMode }: { slug: string; event: EventData; testMode: boolean }) {
  return (
    <>
      <Navbar />
      <AddPhotoButton eventSlug={slug} />
      <section className="relative min-h-screen flex items-center justify-center text-center px-6">
        <Image src={event.bgImage} alt={event.name} fill priority className="object-cover brightness-50" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 max-w-5xl">
          <h1 className="text-6xl md:text-9xl font-black text-white drop-shadow-2xl mb-8">{event.name}</h1>
          <p className="text-lg md:text-2xl text-gray-200 leading-relaxed max-w-4xl mx-auto">{event.description}</p>
          <WeatherBadge testMode={testMode} />
          <div className="mt-12">
            <div className="inline-block animate-bounce">
              <div className="w-10 h-16 border-4 border-white/50 rounded-full flex justify-center">
                <div className="w-2 h-6 bg-white/70 rounded-full mt-3 animate-bounce" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl font-bold text-center text-white mb-16">Gallery</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {event.images.map((src, i) => (
              <div key={i} className="opacity-0 translate-y-10 animate-fadeIn" style={{ animationDelay: `${i * 0.2}s`, animationFillMode: "forwards" }}>
                <div className="group relative overflow-hidden rounded-2xl shadow-2xl">
                  <GalleryImage src={src} alt={`${event.name} gallery ${i + 1}`} />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
