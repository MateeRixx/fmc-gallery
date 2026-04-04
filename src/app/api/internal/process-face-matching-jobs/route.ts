import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchFacesByFaceId } from "@/lib/awsRekognition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Process one face matching job at a time
export async function POST(req: NextRequest) {
  try {
    // Security: Verify this is called from internal cron/webhook
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[FACE MATCHING JOB] Starting job processor...");

    // Get the next pending job
    const { data: job, error: jobError } = await supabase
      .from("face_matching_jobs")
      .select(
        `
        id,
        visitor_profile_id,
        job_type,
        status,
        visitor_profiles (
          id,
          user_id,
          profile_face_id
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobError || !job) {
      console.log("[FACE MATCHING JOB] No pending jobs found");
      return NextResponse.json({
        message: "No pending jobs",
        processed: 0,
      });
    }

    console.log("[FACE MATCHING JOB] Processing job:", job.id, "Type:", job.job_type);

    // Mark job as running
    await supabase
      .from("face_matching_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    const profile = job.visitor_profiles?.[0];
    if (!profile || !profile.profile_face_id) {
      console.error("[FACE MATCHING JOB] Profile or face ID missing");
      await supabase
        .from("face_matching_jobs")
        .update({
          status: "failed",
          error_message: "Profile not indexed",
        })
        .eq("id", job.id);

      return NextResponse.json({
        error: "Profile not indexed",
        jobId: job.id,
      });
    }

    try {
      // Search AWS for matching faces
      console.log(
        "[FACE MATCHING JOB] Searching AWS for face:",
        profile.profile_face_id
      );

      const searchResults = await searchFacesByFaceId({
        awsFaceId: profile.profile_face_id,
        similarityThreshold: 80,
        maxFaces: 200,
      });

      console.log(
        "[FACE MATCHING JOB] Found",
        searchResults.length,
        "potential matches"
      );

      let matchesCreated = 0;

      // For each face found in event photos, create a match
      for (const result of searchResults) {
        const awsFaceId = result.awsFaceId;
        const similarity = Math.round(result.similarity);

        try {
          // Find photo containing this face
          const { data: photos } = await supabase
            .from("photos")
            .select("id")
            .eq("aws_face_id", awsFaceId)
            .maybeSingle();

          if (photos) {
            // Create match (will skip if already exists due to UNIQUE constraint)
            const { error: insertError } = await supabase
              .from("user_photo_matches")
              .insert({
                visitor_profile_id: profile.id,
                photo_id: photos.id,
                similarity_score: similarity,
                aws_face_id: awsFaceId,
                face_bounding_box: null,
              })
              .select();

            if (!insertError) {
              matchesCreated++;
            } else if (insertError.code !== "23505") {
              // 23505 = unique constraint violation (already exists)
              console.error(
                "[FACE MATCHING JOB] Error creating match:",
                insertError
              );
            }
          }
        } catch (matchError) {
          console.error("[FACE MATCHING JOB] Error processing match:", matchError);
          // Continue with next match
        }
      }

      console.log(
        "[FACE MATCHING JOB] Created",
        matchesCreated,
        "new matches"
      );

      // Mark job as completed
      await supabase
        .from("face_matching_jobs")
        .update({
          status: "completed",
          processed_items: matchesCreated,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json({
        success: true,
        jobId: job.id,
        matchesFound: searchResults.length,
        matchesCreated,
      });
    } catch (error) {
      console.error("[FACE MATCHING JOB] Error searching AWS:", error);

      const errorMsg =
        error instanceof Error
          ? error.message
          : "AWS search failed";

      await supabase
        .from("face_matching_jobs")
        .update({
          status: "failed",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json(
        { error: errorMsg, jobId: job.id },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[FACE MATCHING JOB] Processor error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job processing failed" },
      { status: 500 }
    );
  }
}

// GET: Check job queue status
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: jobs } = await supabase
      .from("face_matching_jobs")
      .select(
        `
        id,
        visitor_profile_id,
        job_type,
        status,
        progress_percent,
        processed_items
      `
      )
      .order("created_at", { ascending: false })
      .limit(10);

    const { count: pendingCount } = await supabase
      .from("face_matching_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return NextResponse.json({
      jobs: jobs || [],
      pendingCount: pendingCount || 0,
    });
  } catch (error) {
    console.error("[FACE MATCHING JOB] Status check error:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
