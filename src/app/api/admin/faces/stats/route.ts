import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const [{ count: totalPhotos }, { count: totalEmbeddings }, { count: totalMatches }, { count: totalVisitors }] = await Promise.all([
      supabase.from("photos").select("id", { count: "exact", head: true }),
      supabase.from("face_embeddings").select("id", { count: "exact", head: true }),
      supabase.from("user_photo_matches").select("id", { count: "exact", head: true }),
      supabase.from("visitor_profiles").select("id", { count: "exact", head: true })
    ]);

    return NextResponse.json({
      total_photos: totalPhotos || 0,
      total_embeddings: totalEmbeddings || 0,
      total_matches: totalMatches || 0,
      total_visitors: totalVisitors || 0
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
