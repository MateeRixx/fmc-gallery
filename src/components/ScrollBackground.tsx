"use client";

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface Props {
  eventsRef: React.RefObject<HTMLDivElement>;
  currentBg: string;
}

export default function ScrollBackground({ eventsRef, currentBg }: Props) {
  const { scrollYProgress } = useScroll({
    target: eventsRef,
    offset: ["start end", "end start"]
  });

  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const eventBgOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);

  return (
    <>
      <motion.div
        style={{ opacity: eventBgOpacity }}
        className="fixed inset-0 -z-10"
      >
        <Image 
          src={currentBg} 
          alt="Event" 
          fill 
          quality={75}
          sizes="100vw"
          className="object-cover" 
        />
      </motion.div>

      <motion.div
        style={{ opacity: overlayOpacity }}
        className="fixed inset-0 -z-10 bg-black"
      />
    </>
  );
}
