"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncMomentsClient({ profileId, awsFaceId }: { profileId: string; awsFaceId: string | null }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only auto-sync once per session by saving to sessionStorage
    // Temporarily disabled sessionStorage so testing works immediately on refresh
    // const hasSynced = sessionStorage.getItem(`sync_${profileId}`);
    if (!awsFaceId) return;

    const performSync = async () => {
      try {
        setSyncing(true);
        const res = await fetch("/api/visitor/matches/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorProfileId: profileId, awsFaceId }),
        });

        if (!res.ok) throw new Error("Sync failed");
        
        sessionStorage.setItem(`sync_${profileId}`, "true");
        router.refresh();
      } catch (err) {
        console.error("BG sync failed:", err);
        setError("Failed to sync new moments");
      } finally {
        setSyncing(false);
      }
    };

    performSync();
  }, [profileId, awsFaceId, router]);

  const handleManualSync = async () => {
    if (!awsFaceId) {
      alert("Missing AWS Face ID. Please re-upload your profile photo.");
      return;
    }
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch("/api/visitor/matches/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorProfileId: profileId, awsFaceId }),
      });
      if (!res.ok) throw new Error("Sync failed");
      router.refresh();
    } catch (err) {
      setError("Failed to sync new moments");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="absolute top-8 right-8">
      <button 
        onClick={handleManualSync}
        disabled={syncing}
        className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all shadow-sm"
      >
        <svg 
          className={`w-4 h-4 text-blue-600 ${syncing ? 'animate-spin' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {syncing ? 'Finding new photos...' : 'Sync New Photos'}
      </button>
      {error && <p className="text-red-500 text-xs mt-2 absolute right-0 w-max">{error}</p>}
    </div>
  );
}
