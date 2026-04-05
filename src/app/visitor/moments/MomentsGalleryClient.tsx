"use client";

import { useState } from "react";
import Image from "next/image";
import Lightbox from "@/components/Lightbox";

type MatchData = {
  id: string;
  photoUrl: string;
  eventTitle: string;
  similarity_score: number;
};

type MomentProps = {
  matches: MatchData[];
};

export default function MomentsGalleryClient({ matches }: MomentProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images = matches.map(m => m.photoUrl);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {matches.map((match, index) => (
          <div 
            key={match.id} 
            onClick={() => setLightboxIndex(index)}
            className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 aspect-[3/4] cursor-pointer"
          >
            <Image 
              src={match.photoUrl} 
              alt="Moment" 
              fill 
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500" 
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform">
              <p className="text-white font-medium truncate">{match.eventTitle}</p>
              <p className="text-white/80 text-xs mt-1 backdrop-blur-sm bg-white/10 w-fit px-2 py-0.5 rounded-md">
                {(match.similarity_score / 100).toFixed(1)}% Match
              </p>
            </div>
          </div>
        ))}
      </div>

      <Lightbox
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={images}
        currentIndex={lightboxIndex ?? 0}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
