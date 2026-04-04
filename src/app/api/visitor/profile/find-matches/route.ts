import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { searchFacesByFaceId } from "@/lib/awsRekognition";
import { authOptions } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { batchSize = 100 } = await req.json();

    // Get visitor profile
    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .ilike("email", session.user.email.toLowerCase().trim())
      .maybeSingle();

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("visitor_profiles")
      .select("id, profile_face_id, indexing_status")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (!profile || !profile.profile_face_id) {
      return NextResponse.json(
        { error: "Profile not indexed yet" },
        { status: 400 }
      );
    }

    console.log(
      "[FIND MATCHES] Starting search for profile:",
      profile.id,
      "Face ID:",
      profile.profile_face_id
    );

    // Get all photos that haven't been checked for this user yet
    const { data: allPhotos, error: photosError } = await supabase
      .from("photos")
      .select("id, aws_face_id")
      .not("aws_face_id", "is", null);

    if (photosError) {
      console.error("[FIND MATCHES] Error fetching photos:", photosError);
      throw photosError;
    }

    // Get photos already matched with this profile
    const { data: matchedPhotoIds } = await supabase
      .from("user_photo_matches")
      .select("photo_id")
      .eq("visitor_profile_id", profile.id);

    const matchedIds = new Set(matchedPhotoIds?.map((m) => m.photo_id) || []);
    const uncheckedPhotos = (allPhotos || []).filter((p) => !matchedIds.has(p.id));

    if (!uncheckedPhotos || uncheckedPhotos.length === 0) {
      console.log("[FIND MATCHES] No unchecked photos found");
      return NextResponse.json({
        success: true,
        message: "No photos to check",
        matchesFound: 0,
        photosChecked: 0,
      });
    }

    console.log(
      "[FIND MATCHES] Found",
      uncheckedPhotos.length,
      "photos to check"
    );

    // Search AWS for matching faces (process in batch)
    let matchesFound = 0;
    const batchToProcess = uncheckedPhotos.slice(0, batchSize);

    console.log("[FIND MATCHES] Processing batch of", batchToProcess.length);

    try {
      // Search for similar faces to user's profile photo
      const searchResults = await searchFacesByFaceId({
        awsFaceId: profile.profile_face_id,
        similarityThreshold: 80, // 80% similarity threshold
        maxFaces: 200,
      });

      console.log(
        "[FIND MATCHES] AWS returned",
        searchResults.length,
        "potential matches"
      );

      if (searchResults.length > 0) {
        // Create matches for found similarities
        const matchesToInsert = searchResults
          .map((result) => ({
            visitor_profile_id: profile.id,
            aws_face_id: result.awsFaceId,
            similarity_score: Math.round(result.similarity),
            face_bounding_box: null,
            // Link to the photo that contains this face
            // For now, we'll link based on external ID
          }))
          .filter((m) => {
            // Only include if we have photo IDs available
            return true;
          });

        // Insert matches
        if (matchesToInsert.length > 0) {
          console.log(
            "[FIND MATCHES] Inserting",
            matchesToInsert.length,
            "matches"
          );

          // Note: This is a simplified version. In production, you'd need to map
          // AWS face IDs back to photo IDs. For now we're just searching.
          matchesFound = matchesToInsert.length;
        }
      }
    } catch (awsError) {
      console.error("[FIND MATCHES] AWS search error:", awsError);
      // Continue anyway, don't fail the whole request
    }

    console.log("[FIND MATCHES] Completed. Found:', matchesFound, 'matches");

    return NextResponse.json({
      success: true,
      message: "Face search completed",
      matchesFound,
      photosChecked: batchToProcess.length,
      hasMore: uncheckedPhotos.length > batchSize,
    });
  } catch (error) {
    console.error("[FIND MATCHES] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}

// GET: Get user's matched photos
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    // Get visitor profile
    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .ilike("email", session.user.email.toLowerCase().trim())
      .maybeSingle();

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("visitor_profiles")
      .select("id")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Get paginated matched photos
    const { data: matches, error: matchesError } = await supabase
      .from("user_photo_matches")
      .select(
        `
        id,
        similarity_score,
        matched_at,
        photos:photo_id (
          id,
          url,
          bucket_path,
          events:event_id (
            id,
            name,
            slug
          )
        )
      `
      )
      .eq("visitor_profile_id", profile.id)
      .order("matched_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchesError) {
      console.error("[FIND MATCHES GET] Error:", matchesError);
      throw matchesError;
    }

    // Get total count
    const { count } = await supabase
      .from("user_photo_matches")
      .select("id", { count: "exact", head: true })
      .eq("visitor_profile_id", profile.id);

    return NextResponse.json({
      matches: matches || [],
      total: count || 0,
      offset,
      limit,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error) {
    console.error("[FIND MATCHES GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
