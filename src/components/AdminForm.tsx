// src/components/AdminForm.tsx
"use client";

import { useEffect, useState } from "react";
import imageCompression from "browser-image-compression";

export default function AdminForm({ eventId, editingId, onSuccess }: { eventId?: number | string | null; editingId?: number | string | null; onSuccess?: () => void }) {
  const currentId = editingId ?? eventId ?? null;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [existingCover, setExistingCover] = useState<string | null>(null);
  const [existingHeroImage, setExistingHeroImage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentId) return;
      setStatus("Loading event...");
      try {
        const loadRes = await fetch(`/api/admin/events?id=${encodeURIComponent(String(currentId))}`, { method: "GET" });
        const j = await loadRes.json();
        const ev = j?.data;
        if (ev) {
          setName(ev.title || "");
          setSlug((ev.slug || "").toLowerCase());
          setDesc(ev.description || "");
          setExistingCover(ev.cover_url || null);
          setExistingHeroImage(ev.hero_image_url || null);
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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || ""}` 
        },
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

      if (!currentId && (!cover || !heroImage)) {
        setStatus("Please select both cover and hero images");
        return;
      }

      setStatus("Compressing images...");

      let coverUrl = existingCover || null;

      async function uploadViaApi(file: File, dir: string) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("dir", dir);
        const res = await fetch("/api/upload", { 
          method: "POST", 
          headers: {
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || ""}`
          },
          body: fd 
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Upload failed (${res.status})`);
        }
        const j = await res.json();
        if (!j?.url) throw new Error("Upload response missing url");
        return j.url as string;
      }

      if (cover) {
        const compressedCover = await imageCompression(cover, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        coverUrl = await uploadViaApi(compressedCover, "covers");
      }

      let heroImageUrl = existingHeroImage || null;
      if (heroImage) {
        const compressedHero = await imageCompression(heroImage, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        heroImageUrl = await uploadViaApi(compressedHero, "heroes");
      }

      const payload: Record<string, unknown> = {
        title: name,
        slug,
        description: desc,
        starts_at: new Date().toISOString(),
      };

      if (coverUrl) payload.cover_url = coverUrl;
      if (heroImageUrl) payload.hero_image_url = heroImageUrl;

      const eventRes = await fetch("/api/admin/events", {
        method: currentId ? "PUT" : "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || ""}`
        },
        body: JSON.stringify(currentId ? { id: currentId, ...payload } : payload),
      });

      if (!eventRes.ok) {
        const j = await eventRes.json();
        setStatus(j.error || "Failed");
        return;
      }

      setStatus(currentId ? "SUCCESS! Event updated" : "SUCCESS! Event added — refresh homepage");
      await fetch("/api/revalidate?path=/", { 
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || ""}`
        }
      });
      if (onSuccess) onSuccess();

      // Reset form
      setName(""); setSlug(""); setDesc(""); setCover(null); setHeroImage(null);
      setExistingCover(null); setExistingHeroImage(null);
    } catch (err: unknown) {
      console.error("Admin form submit failed", err);
      let message = "Unknown error";
      if (err instanceof Error) message = err.message;
      else if (typeof err === "string") message = err;
      else if (err && typeof err === "object" && "message" in err)
        message = String((err as Record<string, unknown>).message);
      setStatus(`Error: ${message}`);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6" />

      <form onSubmit={handleSubmit} className="space-y-8 bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/20">
        <input placeholder="Event Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
        <input placeholder="Slug (e.g. kaltarang)" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="w-full p-4 bg-white/10 rounded-xl text-white" required />
        <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-white h-32" required />
        
        <div className="space-y-2">
          <label className="block text-gray-300 font-semibold">Cover Image (for event cards)</label>
          <input 
            type="file" 
            accept="image/jpeg,image/png,image/webp,image/jpg" 
            onChange={e => setCover(e.target.files?.[0] || null)} 
            className="w-full px-4 py-3 bg-white/10 border border-green-500 rounded-xl text-white focus:outline-none focus:border-[#FFBF00] cursor-pointer"
          />
          {(cover || existingCover) && (
            <p className="text-sm text-green-400">{cover ? `New: ${cover.name}` : "Using existing cover"}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label className="block text-gray-300 font-semibold">Hero Image (for event detail page)</label>
          <input 
            type="file" 
            accept="image/jpeg,image/png,image/webp,image/jpg" 
            onChange={e => setHeroImage(e.target.files?.[0] || null)} 
            className="w-full px-4 py-3 bg-white/10 border border-red-500 rounded-xl text-white focus:outline-none focus:border-[#FFBF00] cursor-pointer"
          />
          {(heroImage || existingHeroImage) && (
            <p className="text-sm text-red-400">{heroImage ? `New: ${heroImage.name}` : "Using existing hero image"}</p>
          )}
        </div>
        
        <button type="submit" className="w-full group relative h-12 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-8 py-2 text-neutral-50 text-2xl font-bold">
          <span className="relative z-10">{currentId ? "UPDATE EVENT" : "ADD EVENT"}</span>
          <span className="absolute inset-0 overflow-hidden rounded-md">
            <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
          </span>
        </button>
        <p className="text-2xl font-bold text-center">{status}</p>
      </form>

      <div className="text-center mt-12" />
    </>
  );
}