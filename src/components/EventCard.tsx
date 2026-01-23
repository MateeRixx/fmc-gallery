// src/components/EventCard.tsx
import Image from "next/image";
import Link from "next/link";

interface Event {
  id: number;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  // year: number; ← REMOVED — Supabase doesn't have it
}

interface Props {
  event: Event;
  isActive?: boolean;
}

export default function EventCard({ event, isActive = false }: Props) {
  const cover = (event.coverImage || "").trim() || "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";
  return (
    <Link href={`/events/${event.slug}`} className="group">
      <div className={`
        relative w-full max-w-sm h-96 rounded-2xl overflow-hidden transition-all duration-500
        ${isActive 
          ? 'scale-105 ring-2 ring-purple-500/50 shadow-2xl' 
          : 'scale-100 hover:scale-105 hover:shadow-xl'
        }
        bg-linear-to-br from-gray-900/50 to-black/50 backdrop-blur-sm border border-white/10
      `}>
        {/* Cover Image */}
        <Image
          src={cover}
          alt={event.name}
          fill
          sizes="(max-width: 640px) 100vw, 28rem"
          quality={80}
          className="object-cover brightness-50 group-hover:brightness-75 transition"
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

        {/* Content */}
        <div className="absolute bottom-6 left-6 right-6">
          <h3 className="text-2xl font-black mb-2 text-white h-12 overflow-hidden">{event.name}</h3>
          <p
            className="text-gray-300 text-sm mb-4 leading-relaxed overflow-hidden min-h-17"
            style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
          >
            {event.description}
          </p>
          <div className="flex items-center justify-between">
            {/* Removed year — no longer needed */}
            <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/40 transition">
              →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
