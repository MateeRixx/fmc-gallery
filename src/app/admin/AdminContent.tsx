"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Event, UserRole } from "@/types";
import { getCurrentUser, clearToken } from "@/lib/jwt";

const AdminForm = dynamic(() => import("@/components/AdminForm"), {
  loading: () => <div className="text-center text-gray-400">Loading form...</div>,
  ssr: false
});

const UserManagementPanel = dynamic(() => import("@/components/UserManagementPanel"), {
  loading: () => <div className="text-center text-gray-400">Loading user management...</div>,
  ssr: false
});

type AdminEvent = Pick<Event, 'id' | 'title' | 'slug'>;

export default function AdminContent({ events: initial }: { events: AdminEvent[] }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [events, setEvents] = useState<AdminEvent[]>(initial);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  
  useEffect(() => {
    try {
      const user = getCurrentUser();
      setCurrentUser(user);
      if (!user) {
        clearToken();
        router.replace("/login");
        return;
      }
      // Token valid, continue
    } catch (err) {
      console.error("Auth check failed:", err);
      clearToken();
      router.replace("/login");
    }
  }, [router]);
  async function fetchEvents() {
    try {
      const token = localStorage.getItem("fmc-auth-token") || "";
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/admin/events", { 
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        clearToken();
        router.replace("/login");
        return;
      }
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
      const token = localStorage.getItem("fmc-auth-token") || "";
      const res = await fetch(`/api/admin/events?id=${encodeURIComponent(String(id))}`, { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchEvents();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }
  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-6xl mx-auto px-6">
        <h1 className="text-7xl font-black mb-12 text-white text-center">
          ADMIN PANEL
        </h1>

        {/* Event Management Section */}
        <div className="mb-12 bg-gray-900 p-8 rounded-lg" data-scroll-anchor>
          <h2 className="text-3xl font-bold mb-6">Event Management</h2>
          <Suspense fallback={<div className="text-center text-gray-400 py-10">Loading form...</div>}>
            <AdminForm editingId={editingId} onSuccess={fetchEvents} />
          </Suspense>
        </div>

        {/* User Management Section - Only for Head and Co-Head */}
        {currentUser && (currentUser.role === UserRole.HEAD || currentUser.role === UserRole.CO_HEAD) && (
          <div className="mb-12 bg-gray-900 p-8 rounded-lg">
            <h2 className="text-3xl font-bold mb-6">User Management</h2>
            <Suspense fallback={<div className="text-center text-gray-400 py-10">Loading user management...</div>}>
              <UserManagementPanel />
            </Suspense>
          </div>
        )}

        {/* Existing Events Section */}
        <div className="mb-12 bg-gray-900 p-8 rounded-lg">
          <h2 className="text-3xl font-bold mb-6">Existing Events</h2>
          {events.length === 0 ? (
            <p className="text-gray-400">No events yet. Create one above.</p>
          ) : (
            <div className="space-y-4">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-4 p-4 bg-gray-800 rounded">
                  <span className="text-lg flex-1">{ev.title || "(untitled)"}</span>
                  <button
                    onClick={() => {
                      setEditingId(ev.id);
                      document.querySelector('[data-scroll-anchor]')?.scrollIntoView({ behavior: 'smooth' });
                    }}
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
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => {
              clearToken();
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
      </div>
    </div>
  );
}
