"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

type UnprocessedPhoto = {
  id: string;
  event_id: string;
  path: string;
};

export default function AdminFacesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [hydrated, setHydrated] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Process existing photos state
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });

  // Database stats
  const [stats, setStats] = useState<{
    total_photos: number;
    total_embeddings: number;
    total_matches: number;
    total_visitors: number;
  }>({
    total_photos: 0,
    total_embeddings: 0,
    total_matches: 0,
    total_visitors: 0,
  });

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/admin/faces/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  useEffect(() => {
    if (hydrated && session?.user) {
      loadStats();
    }
  }, [hydrated, session?.user]);

  const processExistingPhotos = async () => {
    setProcessing(true);
    setProcessStatus("Fetching unprocessed photos...");
    setProcessProgress({ current: 0, total: 0 });

    try {
      const fetchResponse = await fetch("/api/admin/faces/unprocessed");
      if (!fetchResponse.ok) throw new Error("Failed to fetch unprocessed photos");
      
      const { photos } = await fetchResponse.json();
      const unprocessedPhotos: UnprocessedPhoto[] = photos || [];
      const total = unprocessedPhotos.length;
      
      if (total === 0) {
        setProcessStatus("No unprocessed photos found. All photos are already indexed in AWS!");
        setProcessing(false);
        return;
      }

      setProcessProgress({ current: 0, total });
      setProcessStatus(`Indexing ${total} photos via AWS...`);

      // We process photos in smaller batches to avoid serverless timeouts (Vercel limits API executions to 10-15s)
      const BATCH_SIZE = 10;
      let totalFacesIndexed = 0;
      let totalFailedIndexing = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = unprocessedPhotos.slice(i, i + BATCH_SIZE);
        const payload = batch.map((photo) => ({
          photo_id: photo.id,
          event_id: photo.event_id,
          image_url: photo.path,
        }));

        try {
          const indexResponse = await fetch("/api/admin/faces/index-aws", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ photos: payload }),
          });

          if (indexResponse.ok) {
            const indexData = await indexResponse.json();
            totalFacesIndexed += indexData.indexed_faces || 0;
            totalFailedIndexing += indexData.failed_photos || 0;
            
            // Advance progress bar
            setProcessProgress({ current: Math.min(i + BATCH_SIZE, total), total });
            setProcessStatus(`Batch ${Math.round(i/BATCH_SIZE) + 1} complete. Indexed ${totalFacesIndexed} faces so far...`);
            
            // Wait 500ms between batches to respect AWS rate limits
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            console.warn("AWS indexing failed for batch", i);
            totalFailedIndexing += batch.length;
          }
        } catch (error) {
          console.error(`Failed to process batch starting at ${i}:`, error);
        }
      }

      setProcessStatus(
        `✓ Complete! Indexed ${totalFacesIndexed} faces across ${total} photos. All registered visitors have been automatically tagged!`
      );
      loadStats(); // Refresh stats
    } catch (error) {
      console.error("Processing failed:", error);
      setProcessStatus("Processing failed due to a server error.");
    } finally {
      setProcessing(false);
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link
            href="/admin"
            className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-4xl font-black text-white">
              AWS Rekognition Pipeline
            </h1>
            <p className="text-gray-400 mt-2">
              Deep-Learning auto-tagging system. Uploaded photos are instantly processed against registered User AWS records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Summary Stats */}
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 lg:col-span-1 border-purple-500/30">
            <h2 className="text-xl font-bold mb-6 text-purple-400">Database Status</h2>
            <ul className="space-y-4">
              <li className="flex justify-between items-center bg-black/40 p-3 rounded-lg">
                <span className="text-gray-400">Total Photos</span>
                <span className="font-mono text-xl">{stats.total_photos.toLocaleString()}</span>
              </li>
              <li className="flex justify-between items-center bg-black/40 p-3 rounded-lg">
                <span className="text-gray-400">AWS Faces Indexed</span>
                <span className="font-mono text-xl">{stats.total_embeddings.toLocaleString()}</span>
              </li>
              <li className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-purple-500/20">
                <span className="text-gray-400">Auto-Tagged Matches</span>
                <span className="font-mono text-xl font-bold text-green-400">{stats.total_matches.toLocaleString()}</span>
              </li>
              <li className="flex justify-between items-center bg-black/40 p-3 rounded-lg">
                <span className="text-gray-400">Registered Visitors</span>
                <span className="font-mono text-xl">{stats.total_visitors.toLocaleString()}</span>
              </li>
            </ul>
            <button
              onClick={loadStats}
              className="mt-6 w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-400 transition"
            >
              ↻ Refresh Stats
            </button>
          </div>

          <div className="lg:col-span-2 grid gap-6">
            <div className="bg-[#111] border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-2">Process Uploaded Photos</h2>
              <p className="text-sm text-gray-400 mb-6">
                Scan all un-indexed photos in the gallery using AWS Rekognition and auto-tag recognized visitors. This is usually triggered automatically, but you can manually batch-process imports here.
              </p>

              <button
                onClick={processExistingPhotos}
                disabled={processing}
                className="w-full flex justify-center items-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/30 text-white rounded-lg font-bold transition-colors"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Scan & Auto-Tag Missing Photos"
                )}
              </button>

              {processStatus && (
                <div className="mt-6 p-4 bg-black/40 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <p className="text-sm font-medium text-blue-400">{processStatus}</p>
                  </div>
                  {processProgress.total > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round((processProgress.current / processProgress.total) * 100)}% ({processProgress.current} / {processProgress.total})</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-blue-500 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-[10px] font-bold text-white relative"
                          style={{ width: `${Math.max(5, (processProgress.current / processProgress.total) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-6">
               <h2 className="text-xl font-bold mb-2 text-red-400">Legacy Architecture Removed</h2>
               <p className="text-sm text-gray-400 mb-0">
                 The inefficient CPU-bound local scikit-learn face clustering systems (DBSCAN / K-Means) and the respective "recluster" API endpoints were removed. The FMC pipeline now strictly runs on highly-scalable Supervised Classification directly mapped via AWS Rekognition User Collections.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
