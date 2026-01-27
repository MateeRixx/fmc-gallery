"use client";
 
import React, { useEffect, useState } from "react";
import ClientGallery from "./ClientGallery";
import {supabase} from "@/lib/supabase";
import { Event } from "@/types";

 
export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params);
  const [event, setEvent] = useState<Omit<Event, 'id' | 'slug'> | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const sanitize = (u?: string | null) => (u || "").trim().replace(/\)+$/, "");
 
  useEffect(() => {
     let cancelled = false;
     async function run() {
       try {
         const { data: ev, error: evError } = await supabase
           .from("events")
           .select("id, title, description, hero_image_url")
           .eq("slug", slug)
           .maybeSingle();
         
         if (evError) {
           console.error("Error fetching event:", evError);
         }
         if (!cancelled) setEvent(ev ? { title: ev.title, description: ev.description, cover_url: ev.hero_image_url } : null);

         // First get the event ID, then fetch photos
         if (ev?.id) {
           const { data: ph, error: phError } = await supabase
             .from("photos")
             .select("path")
             .eq("event_id", ev.id)
             .order("id", { ascending: true });
           
           if (phError) {
             console.error("Error fetching photos:", phError);
           }
           if (!cancelled) setPhotos((ph || []).map(r => sanitize(r.path)));
         }
       } catch (err) {
         console.error("Fetch error:", err);
       }
     }
     run();
     return () => {
       cancelled = true;
     };
   }, [slug]);
 
   const baseEvent = event
     ? {
         name: event.title,
         description: event.description,
         bgImage: sanitize(event.cover_url) || "/images/hero.jpg",
         images: photos,
       }
     : undefined;
 
   return <ClientGallery slug={slug} baseEvent={baseEvent} />;
 }
 
