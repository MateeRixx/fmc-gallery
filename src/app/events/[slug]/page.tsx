import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import ClientGallery from "./ClientGallery";

// ISR: Revalidate every 4 hours (14400 seconds)
// Event photos change less frequently but need some freshness
export const revalidate = 14400;

type LoadedEvent = {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
};

async function getEvent(slug: string): Promise<LoadedEvent | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase not configured");
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: ev, error } = await supabase
    .from("events")
    .select("id, title, description, hero_image_url")
    .neq("slug", "profile-photos")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error fetching event:", error);
    return null;
  }

  if (!ev) {
    return null;
  }

  return {
    id: String(ev.id),
    title: ev.title,
    description: ev.description,
    cover_url: ev.hero_image_url,
  };
}

async function getEventPhotos(eventId: string): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: photos, error } = await supabase
    .from("photos")
    .select("path")
    .eq("event_id", eventId)
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching photos:", error);
    return [];
  }

  const sanitize = (u?: string | null) => (u || "").trim().replace(/\)+$/, "");
  return (photos || []).map((p) => sanitize(p.path));
}

// Pre-generate pages for the most important events
export async function generateStaticParams() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: events } = await supabase
    .from("events")
    .select("slug")
    .neq("slug", "profile-photos")
    .order("starts_at", { ascending: false })
    .limit(10); // Pre-generate the 10 most recent events

  return (events || []).map((event) => ({
    slug: event.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return {
      title: "Event Not Found",
    };
  }

  return {
    title: `${event.title} - FMC Gallery`,
    description: event.description || "View photos from this event",
  };
}

const sanitize = (u?: string | null) => (u || "").trim().replace(/\)+$/, "");

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    notFound();
  }

  const photos = await getEventPhotos(event.id);

  const baseEvent = {
    id: event.id,
    name: event.title,
    description: event.description,
    bgImage: sanitize(event.cover_url) || "/images/hero.jpg",
    images: photos,
  };

  return <ClientGallery slug={slug} baseEvent={baseEvent} />;
}
