// src/components/AdminForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Submitting...");

    try {
      const { data: existing, error: checkErr } = await supabase
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (checkErr) {
        setStatus("Error — try again");
        return;
      }
      if (existing) {
        setStatus("Slug already exists — choose another");
        return;
      }

      let finalCoverUrl = coverUrl.trim();

      if (cover) {
        const fd = new FormData();
        fd.append("file", cover);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setStatus(json.error || "Upload failed");
          return;
        }
        finalCoverUrl = json.url;
      }

      if (!finalCoverUrl) {
        setStatus("Provide a cover image (file or URL)");
        return;
      }

      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description: desc, cover_url: finalCoverUrl }),
      });
      const json = await res.json();

      if (res.ok) {
        setStatus("SUCCESS!");
        await fetch("/api/revalidate?path=/", { method: "POST" });
        setName(""); setSlug(""); setDesc(""); setCover(null); setCoverUrl("");
      } else {
        setStatus(json.error || "Insert failed");
      }
    } catch {
      setStatus("Error — try again");
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => {
            localStorage.removeItem("fmc-admin");
            window.location.href = "/";
          }}
          className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
        >
          Logout
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8 bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/20">
      <input placeholder="Event Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
      <input placeholder="Slug (e.g. kaltarang)" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
      <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white h-32" required />
      <input type="file" accept="image/*" onChange={e => setCover(e.target.files?.[0] || null)} />
      <input placeholder="Cover Image URL (optional)" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white" />
      <button type="submit" className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold rounded-xl hover:scale-105 transition">
        ADD EVENT
      </button>
      <p className="text-2xl font-bold text-center">{status}</p>
      </form>
      <div className="text-center mt-12">
        <Link href="/" className="inline-block px-10 py-5 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition">
          ← Back to Home
        </Link>
      </div>
    </>
  );
}
