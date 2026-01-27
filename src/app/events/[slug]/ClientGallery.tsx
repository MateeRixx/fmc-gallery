"use client";
import EventGalleryClient, { type EventData } from "./EventGalleryClient";

export default function ClientGallery({ slug, baseEvent }: { slug: string; baseEvent?: EventData }) {
  const event: EventData = baseEvent ?? {
    name: "Event",
    description: "",
    bgImage: "/images/hero.jpg",
    images: [],
  };
  return <EventGalleryClient slug={slug} event={event} />;
}
