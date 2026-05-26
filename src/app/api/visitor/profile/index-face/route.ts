import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { indexFacesFromImageBytes } from "@/lib/awsRekognition";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = getSupabaseAdmin();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get visitor profile for this user
    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .ilike("email", session.user.email.toLowerCase().trim())
      .maybeSingle();

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("visitor_profiles")
      .select("id, profile_photo_url, profile_face_id")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Skip if already indexed
    if (profile.profile_face_id) {
      return NextResponse.json({
        success: true,
        message: "Profile already indexed",
        faceId: profile.profile_face_id,
      });
    }

    if (!profile.profile_photo_url) {
      return NextResponse.json(
        { error: "Profile photo not found" },
        { status: 400 }
      );
    }

    console.log("[INDEX FACE] Starting indexing for profile:", profile.id);

    // Update status to 'indexing'
    await supabase
      .from("visitor_profiles")
      .update({ indexing_status: "indexing" })
      .eq("id", profile.id);

    // Download photo from storage URL
    const photoResponse = await fetch(profile.profile_photo_url);
    if (!photoResponse.ok) {
      throw new Error("Failed to fetch profile photo");
    }

    const photoBuffer = await photoResponse.arrayBuffer();
    const photoBytes = new Uint8Array(photoBuffer);

    // Index face to AWS Rekognition
    console.log("[INDEX FACE] Calling AWS Rekognition...");
    const indexedFaces = await indexFacesFromImageBytes({
      imageBytes: photoBytes,
      externalImageId: `visitor_${profile.id}`,
      maxFaces: 1, // Only index the primary face
    });

    if (indexedFaces.length === 0) {
      console.error("[INDEX FACE] No face detected in profile photo");
      await supabase
        .from("visitor_profiles")
        .update({
          indexing_status: "failed",
          indexing_error: "No face detected in photo",
        })
        .eq("id", profile.id);

      return NextResponse.json(
        { error: "No face detected in profile photo" },
        { status: 400 }
      );
    }

    const awsFaceId = indexedFaces[0].awsFaceId;
    console.log("[INDEX FACE] Face indexed to AWS:", awsFaceId);

    // Store AWS face ID and mark as indexed
    const { error: updateError } = await supabase
      .from("visitor_profiles")
      .update({
        profile_face_id: awsFaceId,
        profile_indexed_at: new Date().toISOString(),
        indexing_status: "indexed",
        indexing_error: null,
      })
      .eq("id", profile.id);

    if (updateError) {
      console.error("[INDEX FACE] Error updating profile:", updateError);
      throw updateError;
    }

    console.log("[INDEX FACE] Profile indexed successfully:", profile.id);

    // Trigger background job to find matches
    const { error: jobError } = await supabase
      .from("face_matching_jobs")
      .insert({
        visitor_profile_id: profile.id,
        job_type: "initial_match",
        status: "pending",
      });

    if (jobError) {
      console.error("[INDEX FACE] Error creating job:", jobError);
      // Don't fail the request, job can be retried
    }

    return NextResponse.json({
      success: true,
      message: "Profile photo indexed successfully",
      faceId: awsFaceId,
      jobCreated: !jobError,
    });
  } catch (error) {
    console.error("[INDEX FACE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Indexing failed" },
      { status: 500 }
    );
  }
}

// GET: Check indexing status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      .select("id, indexing_status, indexing_error, profile_face_id, profile_indexed_at")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: profile.indexing_status,
      error: profile.indexing_error,
      indexed: !!profile.profile_face_id,
      indexedAt: profile.profile_indexed_at,
    });
  } catch (error) {
    console.error("[INDEX FACE GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
