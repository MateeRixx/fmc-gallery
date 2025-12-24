// src/components/AdminForm.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase";

export default function AdminForm({ eventId, editingId, onSuccess }: { eventId?: number | null; editingId?: number | null; onSuccess?: () => void }) {
  const currentId = editingId ?? eventId ?? null;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [bg, setBg] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [existingCover, setExistingCover] = useState<string | null>(null);
  const [existingBg, setExistingBg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentId) return;
      setStatus("Loading event...");
      try {
        const loadRes = await fetch(`/api/admin/events?id=${currentId}`, { method: "GET" });
        const j = await loadRes.json();
        const ev = j?.data;
        if (ev) {
          setName(ev.name || "");
          setSlug((ev.slug || "").toLowerCase());
          setDesc(ev.description || "");
          setExistingCover(ev.cover_url || null);
          setExistingBg(ev.bg_url || null);
          setStatus("");
        } else {
          setStatus("Event not found");
        }
      } catch {
        setStatus("Failed to load");
      }
    }
    load();
  }, [currentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !desc) {
      setStatus("Please fill all fields");
      return;
    }

    try {
      const slugRes = await fetch("/api/admin/events/check-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, excludeId: currentId }),
      });
      
      if (!slugRes.ok) {
        setStatus(`❌ Server error: ${slugRes.status}`);
        return;
      }

      let slugCheck;
      try {
        slugCheck = await slugRes.json();
      } catch {
        setStatus("❌ Invalid response from server");
        return;
      }

      if (slugCheck.exists) {
        setStatus("Slug already exists — choose another");
        return;
      }

      if (!currentId) {
        if (!cover || !bg) {
          setStatus("Please select both images");
          return;
        }
      }

      setStatus("Compressing images...");

      let coverUrl = existingCover || null;
      let bgUrl = existingBg || null;

      if (cover) {
        const compressedCover = await imageCompression(cover, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const coverPath = `covers/${slug}-${Date.now()}-${compressedCover.name}`;
        const { error: coverError } = await supabase.storage
          .from("event-images")
          .upload(coverPath, compressedCover, { upsert: true });

        if (coverError) throw coverError;

        coverUrl = supabase.storage.from("event-images").getPublicUrl(coverPath).data.publicUrl;
      }

      if (bg) {
        const compressedBg = await imageCompression(bg, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2560,
          useWebWorker: true,
        });

        const bgPath = `bgs/${slug}-${Date.now()}-${compressedBg.name}`;
        const { error: bgError } = await supabase.storage
          .from("event-images")
          .upload(bgPath, compressedBg, { upsert: true });

        if (bgError) throw bgError;

        bgUrl = supabase.storage.from("event-images").getPublicUrl(bgPath).data.publicUrl;
      }

      const payload = {
        name,
        slug,
        description: desc,
        ...(coverUrl ? { cover_url: coverUrl } : {}),
        ...(bgUrl ? { bg_url: bgUrl } : {}),
      };

      const eventRes = await fetch("/api/admin/events", {
        method: currentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentId ? { id: currentId, ...payload } : payload),
      });

      if (!eventRes.ok) {
        const j = await eventRes.json();
        setStatus(j.error || "Failed");
        return;
      }

      setStatus(currentId ? "SUCCESS! Event updated" : "SUCCESS! Event added — refresh homepage");
      await fetch("/api/revalidate?path=/", { method: "POST" });
      if (onSuccess) onSuccess();

      // Reset form
      setName(""); setSlug(""); setDesc(""); setCover(null); setBg(null);
      setExistingCover(null); setExistingBg(null);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
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
          className="group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-8 py-2 text-neutral-50 font-bold"
        >
          <span className="relative z-10">Logout</span>
          <span className="absolute inset-0 overflow-hidden rounded-md">
            <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:-translate-x-0 group-hover:scale-150"></span>
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/20">
        <input placeholder="Event Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
        <input placeholder="Slug (e.g. kaltarang)" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
        <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white h-32" required />
        <input type="file" accept="image/*" onChange={e => setCover(e.target.files?.[0] || null)} />
        <input type="file" accept="image/*" onChange={e => setBg(e.target.files?.[0] || null)} />
        <button type="submit" className="w-full group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-8 py-2 text-neutral-50 text-2xl font-bold">
          <span className="relative z-10">{currentId ? "UPDATE EVENT" : "ADD EVENT"}</span>
          <span className="absolute inset-0 overflow-hidden rounded-md">
            <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:-translate-x-0 group-hover:scale-150"></span>
          </span>
        </button>
        <p className="text-2xl font-bold text-center">{status}</p>
      </form>

      <div className="text-center mt-12">
        <Link href="/" className="inline-block group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-10 py-2 text-neutral-50 font-bold">
          <span className="relative z-10">← Back to Home</span>
          <span className="absolute inset-0 overflow-hidden rounded-md">
            <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:-translate-x-0 group-hover:scale-150"></span>
          </span>
        </Link>
      </div>
    </>
  );
}