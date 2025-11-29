"use client";
import EventGalleryClient, { type EventData } from "./EventGalleryClient";

export default function ClientGallery({ slug, baseEvent, testMode }: { slug: string; baseEvent?: EventData; testMode: boolean }) {
  const event: EventData = baseEvent ?? {
    name: "Test Event",
    description: "Sample event view with test images and data.",
    bgImage: "/images/hero.jpg",
    images: Array.from({ length: 8 }, () => "/images/kaltarang-cover.jpg"),
  };
  return <EventGalleryClient slug={slug} event={event} testMode={testMode} />;
}
