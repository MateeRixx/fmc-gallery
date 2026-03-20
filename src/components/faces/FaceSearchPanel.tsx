"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { extractFaceEmbeddings } from "@/lib/faceEmbedding";

type FaceSearchResult = {
  face_id: number;
  photo_id: string;
  event_id: string;
  bbox: { x: number; y: number; width: number; height: number };
  photo_url: string;
  similarity: number;
  event_slug?: string | null;
  event_title?: string | null;
};

type FaceSearchPanelProps = {
  title?: string;
  description?: string;
  eventId?: string | null;
  defaultThreshold?: number;
  defaultLimit?: number;
  onMatchedPhotoUrlsChange?: (photoUrls: string[] | null) => void;
};

function normalizeUrl(url: string) {
  return (url || "").trim().replace(/\)+$/, "");
}

export default function FaceSearchPanel({
  title = "Search By Face",
  description = "Upload a photo containing a face to find visually similar faces.",
  eventId = null,
  defaultThreshold = 0.35,
  defaultLimit = 60,
  onMatchedPhotoUrlsChange,
}: FaceSearchPanelProps) {
  const [queryImage, setQueryImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(defaultThreshold);
  const [limit, setLimit] = useState<number>(defaultLimit);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<FaceSearchResult[]>([]);

  const dedupedResults = useMemo(() => {
    const bestByPhoto = new Map<string, FaceSearchResult>();
    for (const item of results) {
      const key = item.photo_id;
      const current = bestByPhoto.get(key);
      if (!current || item.similarity > current.similarity) {
        bestByPhoto.set(key, item);
      }
    }

    return Array.from(bestByPhoto.values()).sort((a, b) => b.similarity - a.similarity);
  }, [results]);

  const handleChooseImage = (file: File | null) => {
    setQueryImage(file);
    setStatus("");
    setResults([]);
    onMatchedPhotoUrlsChange?.(null);

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return nextPreview;
    });
  };

  const clearSearch = () => {
    setQueryImage(null);
    setStatus("");
    setResults([]);
    onMatchedPhotoUrlsChange?.(null);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  };

  const runSearch = async () => {
    if (!queryImage) {
      setStatus("Pick an image first.");
      return;
    }

    setSearching(true);
    setStatus("Extracting face embedding...");

    try {
      const detected = await extractFaceEmbeddings(queryImage);
      if (!detected.length) {
        setStatus("No face detected in query image.");
        setSearching(false);
        return;
      }

      const bestFace = [...detected].sort((a, b) => b.quality_score - a.quality_score)[0];
      setStatus("Searching similar faces...");

      const response = await fetch("/api/faces/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embedding: bestFace.embedding,
          event_id: eventId,
          threshold,
          limit,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "Face search failed");
        setSearching(false);
        return;
      }

      const nextResults = (data.results || []).map((row: FaceSearchResult) => ({
        ...row,
        photo_url: normalizeUrl(row.photo_url),
      }));

      setResults(nextResults);

      const uniqueUrls = Array.from(
        new Set(nextResults.map((item: FaceSearchResult) => item.photo_url))
      ) as string[];
      onMatchedPhotoUrlsChange?.(uniqueUrls.length ? uniqueUrls : []);

      setStatus(`Found ${nextResults.length} face match(es).`);
    } catch (error) {
      console.error("Face search failed:", error);
      setStatus("Failed to run face search.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-300 mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-200">Query image</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={(e) => handleChooseImage(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
          />

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Face query preview"
              className="w-full h-48 object-cover rounded-lg border border-white/20"
            />
          )}

          <div>
            <label className="text-sm text-gray-300">Threshold</label>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Max matches</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={runSearch}
              disabled={searching || !queryImage}
              className="flex-1 rounded-lg bg-[#FFBF00] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
            <button
              onClick={clearSearch}
              disabled={searching}
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white"
            >
              Clear
            </button>
          </div>

          {status && <p className="text-xs text-gray-300">{status}</p>}
        </div>

        <div className="lg:col-span-2">
          {dedupedResults.length === 0 ? (
            <div className="h-full min-h-48 rounded-lg border border-dashed border-white/15 bg-black/20 flex items-center justify-center">
              <p className="text-sm text-gray-400">No results yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dedupedResults.map((result) => (
                <div key={result.photo_id} className="rounded-lg overflow-hidden border border-white/15 bg-black/30">
                  <img
                    src={result.photo_url}
                    alt="Matched face"
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-2 space-y-1">
                    <p className="text-xs text-[#FFBF00] font-semibold">
                      Similarity {(result.similarity * 100).toFixed(1)}%
                    </p>
                    {result.event_slug ? (
                      <Link
                        href={`/events/${result.event_slug}`}
                        className="text-xs text-gray-200 hover:text-white underline"
                      >
                        {result.event_title || result.event_slug}
                      </Link>
                    ) : (
                      <p className="text-xs text-gray-400">Event: {result.event_id}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
