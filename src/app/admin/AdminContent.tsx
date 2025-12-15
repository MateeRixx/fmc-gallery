"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminForm from "@/components/AdminForm";

export default function AdminContent({ events: initial }: { events: { id: number; name: string }[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<{ id: number; name: string }[]>(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fmc-admin");
      if (!raw) {
        router.replace("/login");
        return;
      }
      const parsed = JSON.parse(raw) as { email?: string; expiry?: number };
      const valid = !!parsed?.email && typeof parsed?.expiry === "number" && parsed.expiry > Date.now();
      if (!valid) {
        localStorage.removeItem("fmc-admin");
        router.replace("/login");
      }
    } catch {
      localStorage.removeItem("fmc-admin");
      router.replace("/login");
    }
  }, [router]);
  async function fetchEvents() {
    try {
      const res = await fetch("/api/admin/events", { method: "GET" });
      const j = await res.json();
      setEvents((j && j.data) || []);
    } catch {
      setEvents([]);
    }
  }
  async function deleteEvent(id: number) {
    try {
      await fetch(`/api/admin/events?id=${id}`, { method: "DELETE" });
      fetchEvents();
    } catch {}
  }
  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-7xl font-black mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          ADMIN PANEL
        </h1>
        <AdminForm editingId={editingId} onSuccess={fetchEvents} />
        <button
          onClick={() => {
            localStorage.removeItem("fmc-admin");
            window.location.href = "/";
          }}
          className="mt-8 px-8 py-4 bg-red-600 text-white rounded-full hover:bg-red-700"
        >
          Logout
        </button>
        <div className="mt-12 text-left">
          <h2 className="text-3xl font-bold mb-6">Existing Events</h2>
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-4 mb-4">
              <span className="text-xl">{ev.name}</span>
              <button onClick={() => setEditingId(ev.id)} className="px-4 py-2 bg-blue-600 rounded">
                Edit
              </button>
              <button onClick={() => deleteEvent(ev.id)} className="px-4 py-2 bg-red-600 rounded">
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
