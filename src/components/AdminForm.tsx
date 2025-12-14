// src/components/AdminForm.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
        const res = await fetch(`/api/admin/events?id=${currentId}`, { method: "GET" });
        const j = await res.json();
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
      const { data: existingSlug } = await supabase
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!currentId && existingSlug) {
        setStatus("Slug already exists — choose another");
        return;
      }
      if (currentId && existingSlug && existingSlug.id !== currentId) {
        setStatus("Slug already exists — choose another");
        return;
      }

      let coverUrl = existingCover || null;
      let bgUrl = existingBg || null;

      if (!currentId) {
        if (!cover || !bg) {
          setStatus("Please select both images");
          return;
        }
      }

      if (cover) {
        setStatus("Uploading cover...");
        const coverFd = new FormData();
        coverFd.append("file", cover);
        coverFd.append("dir", "covers");
        const coverRes = await fetch("/api/upload", { method: "POST", body: coverFd });
        const coverJson = await coverRes.json();
        if (!coverRes.ok) {
          setStatus(coverJson.error || "Upload failed");
          return;
        }
        coverUrl = coverJson.url;
      }

      if (bg) {
        setStatus("Uploading background...");
        const bgFd = new FormData();
        bgFd.append("file", bg);
        bgFd.append("dir", "backgrounds");
        const bgRes = await fetch("/api/upload", { method: "POST", body: bgFd });
        const bgJson = await bgRes.json();
        if (!bgRes.ok) {
          setStatus(bgJson.error || "Upload failed");
          return;
        }
        bgUrl = bgJson.url;
      }

      const payload = {
        name,
        slug,
        description: desc,
        ...(coverUrl ? { cover_url: coverUrl } : {}),
        ...(bgUrl ? { bg_url: bgUrl } : {}),
      };

      const res = await fetch("/api/admin/events", {
        method: currentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentId ? { id: currentId, ...payload } : payload),
      });
      if (!res.ok) {
        let msg = currentId ? "Update failed" : "Insert failed";
        try {
          const j = await res.json();
          msg = (j as { error?: string }).error ?? msg;
        } catch {}
        setStatus(msg);
        return;
      }

      setStatus(currentId ? "SUCCESS! Event updated" : "SUCCESS! Event added — refresh homepage");
      await fetch("/api/revalidate?path=/", { method: "POST" });
      if (onSuccess) onSuccess();
      setName(""); setSlug(""); setDesc(""); setCover(null); setBg(null);
      setExistingCover(null); setExistingBg(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setStatus(`Error: ${msg}`);
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
      <input type="file" accept="image/*" onChange={e => setBg(e.target.files?.[0] || null)} />
      <button type="submit" className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold rounded-xl hover:scale-105 transition">
        {currentId ? "UPDATE EVENT" : "ADD EVENT"}
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
