import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchFacesByFaceId } from "@/lib/awsRekognition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { visitorProfileId, awsFaceId } = await req.json();

    if (!visitorProfileId || !awsFaceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`Syncing matches for visitor ${visitorProfileId} using AWS face ${awsFaceId}`);

    // Call AWS Rekognition to get all matching faces
    const similarityThreshold = Number(process.env.AWS_SIMILARITY_THRESHOLD) || 80;
    
    const matches = await searchFacesByFaceId({
      awsFaceId: awsFaceId,
      similarityThreshold,
      maxFaces: 4000,
    });

    if (matches.length === 0) {
      console.log(`No matches found for visitor ${visitorProfileId}`);
      return NextResponse.json({ success: true, matchedCount: 0 });
    }

    // Extract all matched AWS face IDs
    const matchedAwsFaceIds = matches.map(m => m.awsFaceId);

    // Look up the photo IDs corresponding to these AWS face IDs 
    // from the face_embeddings table
    const BATCH_SIZE = 200;
    let newMatches = 0;

    for (let i = 0; i < matchedAwsFaceIds.length; i += BATCH_SIZE) {
      const batchIds = matchedAwsFaceIds.slice(i, i + BATCH_SIZE);
      
      const { data: embeddings, error } = await supabase
        .from("face_embeddings")
        .select("photo_id, aws_face_id, bbox")
        .in("aws_face_id", batchIds);

      if (error) {
        console.error("Error fetching embeddings for AWS face IDs:", error);
        continue;
      }

      if (!embeddings || embeddings.length === 0) continue;

      // Prepare insertions for user_photo_matches table
      const inserts = embeddings.map(emb => {
        // Find corresponding AWS match to get the similarity score
        const matchData = matches.find(m => m.awsFaceId === emb.aws_face_id);
        
        return {
          visitor_profile_id: visitorProfileId,
          photo_id: emb.photo_id,
          similarity_score: Math.round((matchData?.similarity || 0) * 100),
          face_bounding_box: emb.bbox
        };
      });

      // Insert incrementally but skip existing pairs
      const { error: insertError } = await supabase
        .from("user_photo_matches")
        .upsert(inserts, { 
          onConflict: "visitor_profile_id, photo_id",
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error("Error inserting matches:", insertError);
      } else {
        newMatches += inserts.length;
      }
    }

    console.log(`Successfully synced ${newMatches} matches for visitor ${visitorProfileId}`);
    return NextResponse.json({ success: true, matchedCount: newMatches, totalAwsMatches: matches.length });

  } catch (error) {
    console.error("Error syncing visitor matches:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
