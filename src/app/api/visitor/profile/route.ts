import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { indexFacesFromImageBytes, createUser, associateFacesToUser } from "@/lib/awsRekognition";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";

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

    const formData = await req.formData();
    const photo = formData.get("photo") as File;
    const fullName = formData.get("fullName") as string;

    if (!photo) {
      return NextResponse.json({ error: "Photo required" }, { status: 400 });
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: "Full name required" }, { status: 400 });
    }

    // Validate file type
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an image." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // IMPORTANT: Fetch the ACTUAL user record from database to get UUID
    const normalizedEmail = session.user.email.toLowerCase().trim();
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id")
      .ilike("email", normalizedEmail) // Case-insensitive search
      .maybeSingle();

    let userId: string;

    if (!userRecord) {
      // User doesn't exist yet - create them now
      console.log("User not found, creating now:", normalizedEmail);
      const { v4: uuidv4 } = await import("uuid");
      const newUserId = uuidv4();

      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          id: newUserId,
          email: normalizedEmail,
          full_name: fullName.trim(),
          user_type: "VISITOR",
          oauth_provider: "google",
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating user:", createError);
        return NextResponse.json(
          { error: `Failed to create user: ${createError.message}` },
          { status: 500 }
        );
      }

      if (!newUser) {
        console.error("User created but no ID returned");
        return NextResponse.json(
          { error: "User created but could not retrieve ID" },
          { status: 500 }
        );
      }
      userId = newUser.id;
    } else {
      userId = userRecord.id;
    }

    console.log("Profile creation for user:", { email: normalizedEmail, userId });

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("visitor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Profile already exists" },
        { status: 409 }
      );
    }

    // Step 1: Upload photo to Supabase Storage
    const fileExt = "jpg"; // Standardize on highly efficient JPEGs
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `visitors/${fileName}`;

    const rawBuffer = Buffer.from(await photo.arrayBuffer());

    // Compress with sharp (Profile photos only need to be clear enough for AWS Rekognition)
    const photoBuffer = await sharp(rawBuffer)
      .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, photoBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: `Storage error: ${uploadError.message || JSON.stringify(uploadError)}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // Step 2: Extract face via AWS Rekognition
    const awsFaces = await indexFacesFromImageBytes({
      imageBytes: photoBuffer,
      externalImageId: `profile_${userId}`,
      maxFaces: 1, // Only expect one primary face for profile
    });

    if (!awsFaces || awsFaces.length === 0) {
      // Clean up: delete uploaded photo if no face
      await supabase.storage.from("profile-photos").remove([filePath]);
      return NextResponse.json(
        { error: "No face detected in the photo. Please upload a clear photo of your face." },
        { status: 400 }
      );
    }
    
    if (awsFaces.length > 1) {
       console.warn(`Warning: ${awsFaces.length} faces detected in profile photo for ${userId}. Using the most prominent one.`);
    }

    const awsFaceId = awsFaces[0].awsFaceId;
    const bbox = awsFaces[0].bbox;

    // Create a User grouping in AWS Rekognition for this visitor
    try {
      await createUser({ userId });
      await associateFacesToUser({ userId, faceIds: [awsFaceId] });
      console.log(`Created AWS User and associated faceId: ${awsFaceId} to user: ${userId}`);
    } catch (awsUserError) {
      console.error(`Failed to map AWS Face to User Grouping for ${userId}:`, awsUserError);
      // We do not fail the request if user grouping fails, we just log it.
    }

    // Step 3: Create visitor profile in database
    const { data: profile, error: profileError } = await supabase
      .from("visitor_profiles")
      .insert({
        user_id: userId,
        full_name: fullName.trim(),
        email: session.user.email,
        profile_photo_url: photoUrl,
        aws_face_id: awsFaceId,
        // profile_embedding: null // Handled later if vector clustering is used
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);

      // Clean up: delete uploaded photo if profile creation fails
      await supabase.storage.from("profile-photos").remove([filePath]);

      return NextResponse.json(
        { error: `Database error: ${profileError.message || JSON.stringify(profileError)}` },
        { status: 500 }
      );
    }

    console.log(`Profile created for user ${userId}: ${profile.id} with AWS Face ID: ${awsFaceId}`);

    // Asynchronously find matches using an internal fetch, so we don't block the profile creation response
    try {
      fetch(new URL('/api/visitor/matches/sync', req.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visitorProfileId: profile.id, awsFaceId }),
      }).catch(e => console.error("Async sync failed to start:", e));
    } catch (e) {
      console.error("Could not trigger async match sync:", e);
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        profile_photo_url: profile.profile_photo_url,
      },
    });
  } catch (error) {
    console.error("Profile creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile creation failed" },
      { status: 500 }
    );
  }
}

// GET: Retrieve current user's profile
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("visitor_profiles")
      .select("id, full_name, email, profile_photo_url, created_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching profile:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile: profile || null,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
