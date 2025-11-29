import React from "react";
import { notFound } from "next/navigation";
import ClientGallery from "./ClientGallery";


const eventsData = {
  kaltarang: {
    name: "Kaltarang",
    description:
      "Kaltarang is RGIPT’s Annual Cultural Extravaganza. Celebrated for its Vibrant Showcase of Art, Culture, and Talent. Since its Inception, it has Evolved into a Prestigious Stage Where Creativity and Competition Converge. The 10th Edition — Kaltarang’25 — Promises to Be The Most Spectacular Yet, Uniting Students from Across The Nation in a Celebration Where Imagination Meets Tradition. Featuring an Exciting Lineup of Competitions, Performances, and Workshops, Kaltarang Embodies The Essence of Youth, Passion, and Innovation.",
    bgImage: "/images/bg-kaltarang.jpg",
    images: [
      "/gallery/kaltarang/1.jpg",
      "/gallery/kaltarang/2.jpg",
      "/gallery/kaltarang/3.jpg",
      "/gallery/kaltarang/4.jpg",
      "/gallery/kaltarang/5.jpg",
      "/gallery/kaltarang/6.jpg",
      "/gallery/kaltarang/7.jpg",
      "/gallery/kaltarang/8.jpg",
    ],
  },
  urjotsav: {
    name: "Urjotsav",
    description: "Urjotsav celebrates technology and innovation with competitions, showcases, and workshops.",
    bgImage: "/images/bg-urjotsav.jpg",
    images: [
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
      "/images/urjotsav-cover.jpg",
    ],
  },
  energia: {
    name: "Energia",
    description: "Energia is the annual sports meet featuring competitive events and high energy.",
    bgImage: "/images/bg-energia.jpg",
    images: [
      "/gallery/energia/1.jpg",
      "/gallery/energia/2.jpg",
      "/gallery/energia/3.jpg",
      "/gallery/energia/4.jpg",
      "/gallery/energia/5.jpg",
      "/gallery/energia/6.jpg",
      "/gallery/energia/7.jpg",
      "/gallery/energia/8.jpg",
    ],
  },
} as const;

export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: { test?: string } }) {
  const { slug } = React.use(params);
  const testMode = searchParams?.test === "1";
  const event = eventsData[slug as keyof typeof eventsData];
  if (!event && !testMode) notFound();
  return <ClientGallery slug={slug} baseEvent={event} testMode={testMode} />;
}

// Add fade-in animation
 
