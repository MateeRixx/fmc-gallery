"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Event } from "@/types";
import { useSession, signOut } from "next-auth/react";

const AdminForm = dynamic(() => import("@/components/AdminForm"), {
  loading: () => <div className="text-center text-gray-400">Loading form...</div>,
  ssr: false
});

const MemberManagementPanel = dynamic(() => import("@/components/MemberManagementPanel"), {
  loading: () => <div className="text-center text-gray-400">Loading member management...</div>,
  ssr: false
});

const InviteSendForm = dynamic(() => import("@/components/InviteSendForm"), {
  loading: () => <div className="text-center text-gray-400">Loading invite form...</div>,
  ssr: false
});

type AdminEvent = Pick<Event, 'id' | 'title' | 'slug'>;

export default function AdminContent({ events: initial }: { events: AdminEvent[] }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<AdminEvent[]>(initial);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchEvents();
  }, []);
  async function fetchEvents() {
    try {
      // NextAuth handles session via HttpOnly cookies, no need to pass token
      const res = await fetch("/api/admin/events", {
        method: "GET",
      });
      if (res.status === 401 || res.status === 403) {
        // Unauthorized - session likely expired, redirect to login
        await signOut({ redirect: true, callbackUrl: "/login" });
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
      const res = await fetch(`/api/admin/events?id=${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEvents();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with User Info and Logout */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-purple-600/20 border border-purple-500/50 rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
              <span className="text-sm text-gray-300">
                {session?.user?.email}
              </span>
              <span className="text-xs text-purple-400 ml-3 px-2 py-1 bg-purple-500/20 rounded-full">
                {session?.user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut({ redirect: true, callbackUrl: "/login" });
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 rounded-lg transition"
            title="Sign out"
          >
            <span>↪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <h1 className="text-7xl font-black mb-12 text-white text-center">
          ADMIN PANEL
        </h1>

        {/* Global Admin Actions */}
        <div className="mb-12 flex gap-4 justify-center">
          <button
            onClick={() => window.location.href = "/admin/faces"}
            className="px-8 py-4 bg-[#FFBF00] text-black rounded-full transition font-bold shadow-lg shadow-[#FFBF00]/30 hover:bg-[#ffd45f] hover:-translate-y-0.5 hover:shadow-[#FFBF00]/50 active:translate-y-0 active:shadow-[#FFBF00]/30"
          >
            ✨ Scan & Auto-Tag Photos
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="px-8 py-4 bg-purple-600 text-white rounded-full transition font-bold shadow-lg shadow-purple-500/30 hover:bg-purple-500 hover:-translate-y-0.5 hover:shadow-purple-500/50 active:translate-y-0 active:shadow-purple-500/30"
          >
            🏠 Back to Home
          </button>
        </div>

        {/* Event Management Section */}
        <div className="mb-12 bg-gray-900 p-8 rounded-lg" data-scroll-anchor>
          <h2 className="text-3xl font-bold mb-6">Event Management</h2>
          <Suspense fallback={<div className="text-center text-gray-400 py-10">Loading form...</div>}>
            <AdminForm editingId={editingId} onSuccess={fetchEvents} />
          </Suspense>
        </div>

        {/* User Management Section - Only for Head and Co-Head */}
        {session?.user && ((session.user as any)?.roleLevel >= 2) && (
          <>
            {/* Send Invitations */}
            <div className="mb-12 bg-gray-900 p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6">Send Invitations</h2>
              <Suspense fallback={<div className="text-center text-gray-400 py-10">Loading form...</div>}>
                <InviteSendForm />
              </Suspense>
            </div>

            {/* Member Management */}
            <div className="mb-12 bg-gray-900 p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6">Manage Members</h2>
              <Suspense fallback={<div className="text-center text-gray-400 py-10">Loading members...</div>}>
                <MemberManagementPanel />
              </Suspense>
            </div>
          </>
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

      </div>
    </div>
  );
}
