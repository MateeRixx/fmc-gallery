"use client";
 
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ClientGallery from "./ClientGallery";
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
 
export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ test?: string }> }) {
  const { slug } = React.use(params);
  const sp = React.use(searchParams);
  const testMode = sp?.test === "1";
  const [event, setEvent] = useState<{ name: string; description: string; bg_url?: string | null } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const sanitize = (u?: string | null) => (u || "").trim().replace(/\)+$/, "");
 
  useEffect(() => {
     let cancelled = false;
     async function run() {
       const { data: ev } = await supabase
         .from("events")
         .select("name, description, bg_url")
         .eq("slug", slug)
         .maybeSingle();
       if (!cancelled) setEvent(ev ?? null);
       const { data: ph } = await supabase
         .from("photos")
         .select("url")
         .eq("event_slug", slug)
         .order("id", { ascending: true });
       if (!cancelled) setPhotos((ph || []).map(r => sanitize(r.url)));
     }
     run();
     return () => {
       cancelled = true;
     };
   }, [slug]);
 
   const baseEvent = event
     ? {
         name: event.name,
         description: event.description,
         bgImage: sanitize(event.bg_url) || "/images/hero.jpg",
         images: photos,
       }
     : undefined;
 
   return <ClientGallery slug={slug} baseEvent={baseEvent} testMode={testMode} />;
 }
 
