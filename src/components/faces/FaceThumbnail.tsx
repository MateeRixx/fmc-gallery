"use client";

import { useState } from "react";
import Image from "next/image";

type FaceThumbnailProps = {
  photoUrl: string;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  alt: string;
  className?: string;
};

export default function FaceThumbnail({ photoUrl, bbox, alt, className = "" }: FaceThumbnailProps) {
  const [imageError, setImageError] = useState(false);

  if (imageError || !photoUrl) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 rounded-xl ${className}`}>
        <div className="text-4xl opacity-30">👤</div>
      </div>
    );
  }

  // If we have bbox, create a focused crop around the face
  if (bbox && bbox.width > 0 && bbox.height > 0) {
    // Calculate the center of the face
    const faceCenterX = bbox.x + bbox.width / 2;
    const faceCenterY = bbox.y + bbox.height / 2;

    // Calculate zoom level to fit face nicely in thumbnail
    // Aim to show face + some padding (about 1.5x the face size)
    const faceSize = Math.max(bbox.width, bbox.height);
    const cropSize = faceSize * 1.5; // Add 50% padding around face

    // Calculate crop area bounds
    const cropX = Math.max(0, faceCenterX - cropSize / 2);
    const cropY = Math.max(0, faceCenterY - cropSize / 2);
    const cropWidth = Math.min(1 - cropX, cropSize);
    const cropHeight = Math.min(1 - cropY, cropSize);

    // Calculate the position to center the face in thumbnail
    const positionX = (faceCenterX - cropX) / cropWidth;
    const positionY = (faceCenterY - cropY) / cropHeight;

    return (
      <div className={`relative w-full h-full overflow-hidden bg-black rounded-xl ${className}`}>
        <div
          className="w-full h-full"
          style={{
            background: `url(${photoUrl})`,
            backgroundSize: `${100 / cropWidth}% ${100 / cropHeight}%`,
            backgroundPosition: `${positionX * 100}% ${positionY * 100}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
        {/* Invisible img for error handling */}
        <img
          src={photoUrl}
          alt={alt}
          onError={() => setImageError(true)}
          className="hidden"
        />
      </div>
    );
  }

  // Fallback: show full photo centered on face region
  return (
    <div className={`relative w-full h-full overflow-hidden bg-black rounded-xl ${className}`}>
      <Image
        src={photoUrl}
        alt={alt}
        fill
        sizes="(max-width: 768px) 50vw, 20vw"
        onError={() => setImageError(true)}
        className="object-cover"
      />
    </div>
  );
}
