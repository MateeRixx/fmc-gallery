"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminForm() {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canSubmit = slug.trim().length > 0 && name.trim().length > 0 && coverUrl.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setStatus("Supabase is not configured");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    const { error } = await supabase
      .from("events")
      .insert([{ slug, name, description, cover_url: coverUrl }]);
    if (error) {
      setStatus("Failed to add event");
    } else {
      setStatus("Event added");
      setSlug("");
      setName("");
      setDescription("");
      setCoverUrl("");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-3xl p-8 text-white">
      <div className="grid grid-cols-1 gap-6">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug (e.g., kaltarang)"
          className="w-full px-6 py-4 rounded-xl bg-black/40 border border-white/10"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full px-6 py-4 rounded-xl bg-black/40 border border-white/10"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={4}
          className="w-full px-6 py-4 rounded-xl bg-black/40 border border-white/10"
        />
        <input
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="Cover Image URL"
          className="w-full px-6 py-4 rounded-xl bg-black/40 border border-white/10"
        />
      </div>
      <div className="mt-8 flex items-center gap-4">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="px-8 py-4 rounded-full font-bold bg-purple-600 text-white disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add Event"}
        </button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
    </form>
  );
}
