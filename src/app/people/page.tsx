import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import FaceThumbnail from "@/components/faces/FaceThumbnail";

export const dynamic = "force-dynamic";

type PersonCard = {
  id: number;
  face_count: number;
  photo_count: number;
  event_count?: number;
  cover_url: string | null;
  cover_face_bbox?: { x: number; y: number; width: number; height: number } | null;
};

async function getPeople(userId: string): Promise<PersonCard[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for user_id filtering

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase not configured");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: clusters, error: clusterError } = await supabase
    .from("face_clusters")
    .select("id, face_count, cover_photo_id, cover_face_id, updated_at")
    .eq("user_id", userId)

  if (clusterError) {
    console.error("Error fetching clusters:", clusterError);
    return [];
  }

  if (!clusters || clusters.length === 0) return [];

  const clusterIds = clusters.map((c) => Number(c.id)).filter(Number.isFinite);

  const { data: groupedFaces } = await supabase
    .from("face_embeddings")
    .select("cluster_id, photo_id, event_id")
    .in("cluster_id", clusterIds);

  const statsByCluster = new Map<number, { photoIds: Set<string>; eventIds: Set<string> }>();
  for (const row of groupedFaces || []) {
    const clusterId = Number(row.cluster_id);
    if (!Number.isFinite(clusterId)) continue;

    const current = statsByCluster.get(clusterId) || {
      photoIds: new Set<string>(),
      eventIds: new Set<string>(),
    };
    if (row.photo_id) current.photoIds.add(String(row.photo_id));
    if (row.event_id) current.eventIds.add(String(row.event_id));
    statsByCluster.set(clusterId, current);
  }

  const coverIds = Array.from(
    new Set(clusters.map((c) => c.cover_photo_id).filter(Boolean).map((id) => String(id)))
  );

  const coverFaceIds = Array.from(
    new Set(clusters.map((c) => c.cover_face_id).filter(Boolean).map((id) => Number(id)))
  );

  let coverById = new Map<string, string>();
  let faceBboxById = new Map<number, any>();

  if (coverIds.length > 0) {
    const { data: photos } = await supabase.from("photos").select("id, path").in("id", coverIds);
    coverById = new Map((photos || []).map((p) => [String(p.id), p.path || ""]));
  }

  if (coverFaceIds.length > 0) {
    const { data: faces } = await supabase
      .from("face_embeddings")
      .select("id, bbox")
      .in("id", coverFaceIds);
    faceBboxById = new Map((faces || []).map((f) => [Number(f.id), f.bbox]));
  }

  const people: PersonCard[] = clusters.map((row) => {
    const clusterId = Number(row.id);
    const stats = statsByCluster.get(clusterId);
    const coverPhotoId = row.cover_photo_id ? String(row.cover_photo_id) : null;
    const coverFaceId = row.cover_face_id ? Number(row.cover_face_id) : null;

    return {
      id: clusterId,
      face_count: row.face_count || 0,
      photo_count: stats?.photoIds.size || 0,
      event_count: stats?.eventIds.size || 0,
      cover_url: coverPhotoId ? coverById.get(coverPhotoId) || null : null,
      cover_face_bbox: coverFaceId ? faceBboxById.get(coverFaceId) || null : null,
    };
  });

  return people;
}

export const metadata = {
  title: "My Gallery - FMC Gallery",
  description: "Browse your personal face clusters",
};

export default async function PeoplePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const people = await getPeople(session.user.id);

  if (people.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />

        <section className="pt-28 pb-10 px-6 border-b border-white/10 bg-linear-to-b from-zinc-950 to-black">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-black">My Gallery</h1>
            <p className="mt-4 text-gray-300 max-w-2xl">
              No photos found for your identity yet. 
              Sign up with a clear profile photo and we'll tag you as photos get uploaded!
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-28 pb-10 px-6 border-b border-white/10 bg-linear-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-black">My Gallery</h1>
          <p className="mt-4 text-gray-300 max-w-2xl">
            These are all the photos across FMC Gallery events where your face has been automatically tagged.
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {people.map((person) => (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-[#FFBF00] transition"
              >
                <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5">
                  <FaceThumbnail
                    photoUrl={person.cover_url || ""}
                    bbox={person.cover_face_bbox}
                    alt={`Person ${person.id}`}
                    className="group-hover:scale-110 transition duration-300"
                  />
                </div>

                {/* Hover overlay with info */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-end justify-start p-3">
                  <div className="text-white">
                    <p className="text-xs font-semibold">{person.photo_count} photos</p>
                    <p className="text-[10px] text-gray-300">{person.face_count} detections</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
