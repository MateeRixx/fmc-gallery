"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FaceSearchPanel from "@/components/faces/FaceSearchPanel";
import { getCurrentUser } from "@/lib/jwt";

type UnprocessedPhoto = {
  id: string;
  event_id: string;
  path: string;
};

export default function AdminFacesPage() {
  const router = useRouter();
  const [user, setUser] = useState(getCurrentUser());
  const [hydrated, setHydrated] = useState(false);
  const [eventId, setEventId] = useState("");
  const [threshold, setThreshold] = useState(0.35);
  const [minQuality, setMinQuality] = useState(0.45);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Process existing photos state
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });

  // Database stats
  const [stats, setStats] = useState<{
    total_photos: number;
    total_embeddings: number;
    total_clusters: number;
    photos_with_embeddings: number;
    photos_without_embeddings: number;
  } | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem("fmc-auth-token") || "";
      const response = await fetch("/api/admin/faces/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  useEffect(() => {
    if (hydrated && user) {
      loadStats();
    }
  }, [hydrated, user]);

  const runRecluster = async () => {
    setRunning(true);
    setStatus("Rebuilding people clusters...");

    try {
      const token = localStorage.getItem("fmc-auth-token") || "";
      const response = await fetch("/api/admin/faces/recluster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          threshold,
          min_quality: minQuality,
          reset: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(`Failed: ${data.error || "Unknown error"}`);
        return;
      }

      setStatus(
        `Done. Processed ${data.processed_faces} faces, created ${data.created_clusters} clusters, total ${data.total_clusters} clusters.`
      );
      loadStats(); // Refresh stats
    } catch (error) {
      console.error("Reclustering failed:", error);
      setStatus("Reclustering failed due to a network or server error.");
    } finally {
      setRunning(false);
    }
  };

  const runClusteringOnly = async () => {
    const token = localStorage.getItem("fmc-auth-token") || "";
    const response = await fetch("/api/admin/faces/recluster", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        threshold,
        min_quality: minQuality,
        reset: false,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      setProcessStatus(
        `✓ Clustering complete! Created ${data.created_clusters} clusters from ${data.processed_faces} faces.`
      );
      loadStats();
    } else {
      setProcessStatus(`Clustering failed: ${data.error || "Unknown error"}`);
    }
  };

  const testThresholds = async () => {
    setRunning(true);
    setStatus("Testing different thresholds...");

    try {
      const token = localStorage.getItem("fmc-auth-token") || "";
      const thresholds = [0.2, 0.3, 0.35, 0.4, 0.5, 0.6];
      const results: string[] = [];

      for (const t of thresholds) {
        const response = await fetch("/api/admin/faces/recluster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            threshold: t,
            min_quality: minQuality,
            reset: true,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          results.push(
            `Threshold ${t}: ${data.created_clusters} clusters from ${data.processed_faces} faces`
          );
          // Only show debug logs for first threshold
          if (t === thresholds[0]) {
            console.log(`Debug logs for threshold ${t}:`, data.debug?.distanceLogs);
          }
        } else {
          results.push(`Threshold ${t}: Error - ${data.error}`);
        }
      }

      setStatus(
        `Results:\n${results.join(
          "\n"
        )}\n\nCheck browser console (F12) for detailed distance logs.\nChoose the best threshold and set it above, then click "Run Full Reclustering"`
      );
      loadStats();
    } catch (error) {
      setStatus("Test failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setRunning(false);
    }
  };

  const processExistingPhotos = async () => {
    setProcessing(true);
    setProcessStatus("Fetching unprocessed photos...");
    setProcessProgress({ current: 0, total: 0 });

    try {
      const token = localStorage.getItem("fmc-auth-token") || "";

      // Fetch photos without face embeddings
      const listResponse = await fetch("/api/admin/faces/unprocessed?limit=500&mode=aws", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const listData = await listResponse.json();
      if (!listResponse.ok) {
        setProcessStatus(`Failed: ${listData.error || "Unknown error"}`);
        return;
      }

      console.log("Unprocessed photos response:", listData);
      const photos = (listData.photos || []) as UnprocessedPhoto[];
      console.log(`Found ${photos.length} unprocessed photos out of ${listData.total_unprocessed || "?"}`);

      if (photos.length === 0) {
        // Check if we need to run clustering on existing embeddings
        const token = localStorage.getItem("fmc-auth-token") || "";
        const statsResponse = await fetch("/api/admin/faces/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statsData = await statsResponse.json();

        if (statsResponse.ok && statsData.stats) {
          const { total_embeddings, total_clusters } = statsData.stats;
          if (total_embeddings > 0 && total_clusters === 0) {
            setProcessStatus("No unprocessed photos, but running clustering on existing embeddings...");
            await runClusteringOnly();
            return;
          }
        }

        setProcessStatus("All photos already have face embeddings and clusters!");
        loadStats();
        return;
      }

      setProcessProgress({ current: 0, total: photos.length });
      setProcessStatus("Indexing photos with AWS Rekognition...");
      let totalFacesIndexed = 0;
      let totalFailedIndexing = 0;

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setProcessProgress({ current: i + 1, total: photos.length });
        setProcessStatus(`Processing photo ${i + 1}/${photos.length}...`);

        try {
          const indexResponse = await fetch("/api/admin/faces/index-aws", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              photos: [
                {
                  photo_id: photo.id,
                  event_id: photo.event_id,
                  image_url: photo.path,
                },
              ],
            }),
          });

          if (indexResponse.ok) {
            const indexData = await indexResponse.json();
            totalFacesIndexed += Number(indexData.indexed_faces || 0);
            totalFailedIndexing += Number(indexData.failed_photos || 0);
            if (Number(indexData.failed_photos || 0) > 0) {
              const failures = indexData.failures || [];
              console.warn(`AWS indexing photo failures (${failures.length}):`, failures);

              // Group failures by error type for better debugging
              const errorTypes = failures.reduce((acc: Record<string, number>, f: any) => {
                const errorKey = f.error || 'Unknown error';
                acc[errorKey] = (acc[errorKey] || 0) + 1;
                return acc;
              }, {});

              console.log('Failure breakdown:', errorTypes);

              const firstFailure = failures[0];
              if (firstFailure?.error) {
                setProcessStatus(
                  `Indexing warning: ${firstFailure.error} (${failures.length} photo(s) affected, continuing...)`
                );
              }
            }
          } else {
            const indexData = await indexResponse.json().catch(() => ({}));
            console.warn("AWS indexing failed for photo", photo.id, indexData.error || indexData);
            totalFailedIndexing += 1;
          }
        } catch (error) {
          console.error(`Failed to process photo ${photo.id}:`, error);
        }
      }

      setProcessStatus(
        `Indexed ${totalFacesIndexed} faces (${totalFailedIndexing} photo failures). Running AWS reclustering...`
      );

      // Run reclustering - use reset: true to rebuild all clusters from scratch
      const reclusterResponse = await fetch("/api/admin/faces/recluster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          threshold,
          min_quality: minQuality,
          method: "aws",
          reset: true,  // Force full reclustering
        }),
      });

      const reclusterData = await reclusterResponse.json();
      if (reclusterResponse.ok) {
        setProcessStatus(
          `✓ Complete! Indexed ${totalFacesIndexed} faces, created ${reclusterData.created_clusters} new clusters (${totalFailedIndexing} photo failures).`
        );
        loadStats(); // Refresh stats
      } else {
        setProcessStatus(
          `Indexed ${totalFacesIndexed} faces but reclustering failed: ${reclusterData.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Processing failed:", error);
      setProcessStatus("Processing failed due to an error.");
    } finally {
      setProcessing(false);
    }
  };

  // Don't show auth check until after hydration to prevent mismatch
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Sign in to access face tools.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-5 py-2 rounded-lg bg-[#FFBF00] text-black font-semibold"
          >
            Go To Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-black">Face Tools</h1>
          <p className="text-gray-300 mt-3 max-w-3xl">
            Build and refresh person clusters for Google Photos style People gallery.
          </p>
        </div>

        {stats && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
            <h3 className="text-lg font-bold text-blue-200 mb-3">Database Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Total Photos</p>
                <p className="text-2xl font-bold text-white">{stats.total_photos}</p>
              </div>
              <div>
                <p className="text-gray-400">With Faces</p>
                <p className="text-2xl font-bold text-green-400">{stats.photos_with_embeddings}</p>
              </div>
              <div>
                <p className="text-gray-400">Without Faces</p>
                <p className="text-2xl font-bold text-orange-400">{stats.photos_without_embeddings}</p>
              </div>
              <div>
                <p className="text-gray-400">Face Embeddings</p>
                <p className="text-2xl font-bold text-white">{stats.total_embeddings}</p>
              </div>
              <div>
                <p className="text-gray-400">People Clusters</p>
                <p className="text-2xl font-bold text-purple-400">{stats.total_clusters}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/15 bg-white/5 p-5 space-y-4">
          <h2 className="text-xl font-bold">People Clustering</h2>
          <p className="text-sm text-gray-300">
            Run this after bulk uploads or when you want to regenerate all face groups.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Match threshold</label>
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Minimum face quality</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={minQuality}
                onChange={(e) => setMinQuality(Number(e.target.value))}
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runRecluster}
              disabled={running}
              className="px-5 py-2 rounded-lg bg-[#FFBF00] text-black font-semibold disabled:opacity-50"
            >
              {running ? "Running..." : "Run Full Reclustering"}
            </button>
            <button
              onClick={testThresholds}
              disabled={running}
              className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold disabled:opacity-50 hover:bg-purple-700"
            >
              {running ? "Testing..." : "Test Thresholds"}
            </button>
            <button
              onClick={() => router.push("/people")}
              className="px-5 py-2 rounded-lg border border-white/25 text-white hover:bg-white/10"
            >
              Open People Gallery
            </button>
          </div>

          {status && <p className="text-sm text-yellow-200">{status}</p>}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 p-5 space-y-4">
          <h2 className="text-xl font-bold">Process Existing Photos</h2>
          <p className="text-sm text-gray-300">
            Run face detection on photos that were uploaded before the face system was enabled.
          </p>

          <button
            onClick={processExistingPhotos}
            disabled={processing || running}
            className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold disabled:opacity-50 hover:bg-purple-700"
          >
            {processing ? "Processing..." : "Process Unprocessed Photos"}
          </button>

          {processStatus && (
            <div className="space-y-2">
              <p className="text-sm text-purple-200">{processStatus}</p>
              {processing && processProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(processProgress.current / processProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {processProgress.current} / {processProgress.total} photos
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
          <button
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-sm font-semibold text-white underline"
          >
            {showAdvanced ? "Hide" : "Show"} Advanced Query-by-Face Tester
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Event UUID (optional)</label>
                <input
                  type="text"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value.trim())}
                  placeholder="Leave empty for all events"
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <FaceSearchPanel
                title="Admin Face Similarity Tester"
                description="Optional manual search tool for debugging clusters and thresholds."
                eventId={eventId || null}
                defaultThreshold={0.35}
                defaultLimit={80}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
