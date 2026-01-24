"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Event } from "@/types";

const AdminForm = dynamic(() => import("@/components/AdminForm"), {
  loading: () => <div className="text-center text-gray-400">Loading form...</div>,
  ssr: false
});

type AdminEvent = Pick<Event, 'id' | 'title' | 'slug'>;

export default function AdminContent({ events: initial }: { events: AdminEvent[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<AdminEvent[]>(initial);
  const [editingId, setEditingId] = useState<number | string | null>(null);
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
      if (!res.ok) {
        console.error(`API error: ${res.status}`, res);
        setEvents([]);
        return;
      }
      const j = await res.json();
      setEvents((j && j.data) || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setEvents([]);
    }
  }
  async function deleteEvent(id: number | string) {
    try {
      await fetch(`/api/admin/events?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
      fetchEvents();
    } catch {}
  }
  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-7xl font-black mb-8 text-white">
          ADMIN PANEL
        </h1>
        <Suspense fallback={<div className="text-center text-gray-400 py-10">Loading admin panel...</div>}>
          <AdminForm editingId={editingId} onSuccess={fetchEvents} />
        </Suspense>
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={() => {
              localStorage.removeItem("fmc-admin");
              window.location.href = "/";
            }}
            className="px-8 py-4 bg-red-600 text-white rounded-full transition font-bold shadow-lg shadow-red-500/30 hover:bg-red-500 hover:-translate-y-0.5 hover:shadow-red-500/50 active:translate-y-0 active:shadow-red-500/30"
          >
            Logout
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="px-8 py-4 bg-purple-600 text-white rounded-full transition font-bold shadow-lg shadow-purple-500/30 hover:bg-purple-500 hover:-translate-y-0.5 hover:shadow-purple-500/50 active:translate-y-0 active:shadow-purple-500/30"
          >
            Back to Home
          </button>
        </div>
        <div className="mt-12 text-left">
          <h2 className="text-3xl font-bold mb-6">Existing Events</h2>
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-4 mb-4">
              <span className="text-xl">{ev.title || "(untitled)"}</span>
              <button
                onClick={() => setEditingId(ev.id)}
                className="px-4 py-2 bg-blue-600 rounded transition duration-150 ease-out transform hover:scale-105 hover:-translate-y-0.5 hover:bg-blue-500 shadow-md hover:shadow-blue-500/40 focus:shadow-blue-500/60 focus:outline-none"
              >
                Edit
              </button>
              <button
                onClick={() => deleteEvent(ev.id)}
                className="px-4 py-2 bg-red-600 rounded transition duration-150 ease-out transform hover:scale-105 hover:-translate-y-0.5 hover:bg-red-500 shadow-md hover:shadow-red-500/40 focus:shadow-red-500/60 focus:outline-none"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
