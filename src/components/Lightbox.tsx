"use client";

import { useEffect } from "react";
import Image from "next/image";

type LightboxProps = {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onNavigate: (index: number) => void;
};

export default function Lightbox({ isOpen, onClose, images, currentIndex, onNavigate }: LightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate((currentIndex - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") onNavigate((currentIndex + 1) % images.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-2 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {images.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate((currentIndex - 1 + images.length) % images.length); }}
            className="absolute left-6 z-50 p-3 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition hidden md:block"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate((currentIndex + 1) % images.length); }}
            className="absolute right-6 z-50 p-3 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition hidden md:block"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12" onClick={onClose}>
        <div 
          className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center cursor-default" 
          onClick={(e) => e.stopPropagation()}
        >
          {/* We use standard img here for full size to avoid next/image layout issues with responsive bounds */}
          <Image
            src={images[currentIndex]}
            alt="Expanded view"
            fill
            sizes="100vw"
            quality={95}
            className="object-contain"
            priority
          />
        </div>
      </div>
      
      {images.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 text-center text-white/60 tracking-widest text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
