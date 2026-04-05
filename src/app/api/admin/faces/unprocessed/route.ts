import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: allPhotos } = await supabase.from("photos").select("id, event_id, path");
    const { data: allEmbeddings } = await supabase.from("face_embeddings").select("photo_id");
    
    const processedIds = new Set((allEmbeddings || []).map(e => e.photo_id));
    const unprocessed = (allPhotos || []).filter(p => !processedIds.has(p.id));

    return NextResponse.json({ photos: unprocessed });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get unprocessed photos" }, { status: 500 });
  }
}
