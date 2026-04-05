import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import SyncMomentsClient from "./SyncMomentsClient";
import MomentsGalleryClient from "./MomentsGalleryClient";

export default async function MomentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/visitor/login");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get Visitor Profile ID
  const { data: profile } = await supabase
    .from("visitor_profiles")
    .select("id, full_name, profile_photo_url, aws_face_id")
    .eq("user_id", session.user.id)
    .single();

  if (!profile) {
    redirect("/visitor/profile-setup");
  }

  // Get matched photos
  const { data: matches } = await supabase
    .from("user_photo_matches")
    .select(`
      similarity_score,
      photos!inner (
        id,
        path,
        events!inner (
          id,
          title
        )
      )
    `)
    .eq("visitor_profile_id", profile.id)
    .order("similarity_score", { ascending: false });

  const getPublicUrl = (path: string) => {
    return supabase.storage.from("events").getPublicUrl(path).data.publicUrl;
  };

  const formattedMatches = matches?.map((match: any) => ({
    id: match.photos.id,
    photoUrl: match.photos.path.startsWith('http') ? match.photos.path : getPublicUrl(match.photos.path),
    eventTitle: match.photos.events.title,
    similarity_score: match.similarity_score,
  })) || [];

  return (
    <div className="relative max-w-7xl mx-auto px-4 py-8">
      <SyncMomentsClient profileId={profile.id} awsFaceId={profile.aws_face_id} />

      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-8 border-b pb-6 gap-4">
        <div className="flex items-center space-x-6">
          <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-lg border-2 border-blue-500">  
             {profile.profile_photo_url ? (
               <Image src={profile.profile_photo_url} alt="Profile" fill className="object-cover" />
             ) : (
               <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold text-xl">
                 {profile.full_name.charAt(0)}
               </div>
             )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Moments</h1>
            <p className="text-gray-500 mt-1">Hello, {profile.full_name}. We found {formattedMatches.length} photos of you.</p>
          </div>
        </div>
      </div>

      {formattedMatches.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200 shadow-inner">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No photos found yet</h3>
          <p className="mt-2 text-sm text-gray-500">We will notify you when we spot you in new gallery photos.</p>
        </div>
      ) : (
        <MomentsGalleryClient matches={formattedMatches} />
      )}
    </div>
  );
}
