// src/components/AdminForm.tsx
"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [bg, setBg] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Uploading...");

    try {
      const coverPath = `covers/${Date.now()}-${cover!.name}`;
      const bgPath = `bgs/${Date.now()}-${bg!.name}`;

      await supabase.storage.from("event-images").upload(coverPath, cover!);
      await supabase.storage.from("event-images").upload(bgPath, bg!);

      const { data: coverData } = supabase.storage.from("event-images").getPublicUrl(coverPath);
      const { data: bgData } = supabase.storage.from("event-images").getPublicUrl(bgPath);

      await supabase.from("events").insert({
        name,
        slug,
        description: desc,
        cover_url: coverData.publicUrl,
        bg_url: bgData.publicUrl,
      });

      setStatus("SUCCESS! Event added.");
      setName(""); setSlug(""); setDesc(""); setCover(null); setBg(null);
    } catch (err) {
      setStatus("Error — try again");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/20">
      <input placeholder="Event Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
      <input placeholder="Slug (e.g. kaltarang)" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
      <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white h-32" required />
      <input type="file" accept="image/*" onChange={e => setCover(e.target.files?.[0] || null)} required />
      <input type="file" accept="image/*" onChange={e => setBg(e.target.files?.[0] || null)} required />
      <button type="submit" className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold rounded-xl hover:scale-105 transition">
        ADD EVENT
      </button>
      <p className="text-2xl font-bold text-center">{status}</p>
    </form>
  );
}