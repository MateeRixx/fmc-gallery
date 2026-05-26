/**
 * API Route: POST /api/auth/verify-otp
 *
 * Verify OTP code and create/authenticate user account.
 * Handles membership creation based on invitation or visitor status.
 * Rate Limited: 20 requests per minute per IP
 */

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyOTP, markOTPAsUsed } from "@/lib/otp-utils";
import { createMembership, hasHead, ROLE_LEVELS } from "@/lib/membership-utils";
import { MASTER_EMAIL } from "@/lib/config";
import { rateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { indexFacesFromImageBytes } from "@/lib/awsRekognition";
import { z } from "zod";
import sharp from "sharp";

const VerifyOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  full_name: z.string().optional(),
  invitation_token: z.string().optional(),
});

async function handler(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let email, otp, fullName, invitationToken;
    let photo: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      email = (formData.get("email") as string)?.toLowerCase().trim();
      otp = (formData.get("otp") as string)?.trim();
      fullName = (formData.get("full_name") as string)?.trim() || email?.split("@")[0];
      invitationToken = (formData.get("invitation_token") as string)?.trim();
      photo = formData.get("photo") as File;
    } else {
      const body = await request.json();
      const validated = VerifyOTPSchema.parse(body);
      email = validated.email.toLowerCase().trim();
      otp = validated.otp.trim();
      fullName = validated.full_name?.trim() || email.split("@")[0];
      invitationToken = validated.invitation_token?.trim();
    }

    if (!email || !otp) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ===== VERIFY OTP =====
    const verifyResult = await verifyOTP(email, otp);
    if (!verifyResult.success) {
      return Response.json(
        { error: verifyResult.error || "Invalid OTP" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // ===== DETERMINE ROLE LEVEL =====
    let roleLevel: number = ROLE_LEVELS.VISITOR; // Default to visitor

    // Check for invitation
    let invitedRole: number | null = null;
    if (invitationToken) {
      // Validate invitation
      const { data: invitation, error: invError } = await supabase
        .from("invitations")
        .select("id, email, role, expires_at, is_used")
        .eq("token", invitationToken)
        .eq("is_used", false)
        .maybeSingle();

      if (invError) {
        console.error("Error validating invitation:", invError);
        return Response.json(
          { error: "Invalid invitation" },
          { status: 403 }
        );
      }

      if (!invitation) {
        return Response.json(
          { error: "Invitation not found or already used" },
          { status: 403 }
        );
      }

      // Check expiry
      if (new Date(invitation.expires_at) < new Date()) {
        return Response.json(
          { error: "Invitation has expired" },
          { status: 403 }
        );
      }

      // Check email matches
      if (invitation.email.toLowerCase() !== email) {
        return Response.json(
          { error: "Invitation email does not match" },
          { status: 403 }
        );
      }

      // Convert role string to level
      const roleMap: Record<string, number> = {
        head: ROLE_LEVELS.HEAD,
        co_head: ROLE_LEVELS.CO_HEAD,
        executive: ROLE_LEVELS.EXECUTIVE,
        member: ROLE_LEVELS.EXECUTIVE, // member treated as executive
      };
      invitedRole = roleMap[invitation.role] ?? ROLE_LEVELS.EXECUTIVE;
      roleLevel = invitedRole;
    } else {
      // No invitation - check if bootlegged as HEAD
      const isMaster = email === MASTER_EMAIL.toLowerCase();
      const headExists = await hasHead();

      if (isMaster && !headExists) {
        // First master login - auto-assign HEAD
        roleLevel = ROLE_LEVELS.HEAD;
        console.log(`🎯 Bootstrapping HEAD role for ${email}`);
      } else if (isMaster && headExists) {
        // Master can sign in as visitor if HEAD exists
        roleLevel = ROLE_LEVELS.VISITOR;
      } else {
        // Regular user - visitor by default
        roleLevel = ROLE_LEVELS.VISITOR;
      }
    }

    // ===== CREATE OR UPDATE USER =====
    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Database error:", checkError);
      return Response.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    let userId: string;

    if (existingUser) {
      // If user exists and provides a photo, it means they are trying to sign up again
      if (photo) {
        return Response.json(
          { error: "Account already exists. Please log in instead." },
          { status: 409 }
        );
      }
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email,
          full_name: fullName,
          user_type: "VISITOR", // All users start as visitor in terms of user_type
        })
        .select("id")
        .single();

      if (createError) {
        console.error("User creation error:", createError);
        return Response.json(
          { error: "Failed to create user account" },
          { status: 500 }
        );
      }

      userId = newUser.id;
    }

    // ===== CREATE MEMBERSHIP =====
    if (roleLevel > ROLE_LEVELS.VISITOR) {
      const membershipResult = await createMembership(userId, roleLevel);
      if (!membershipResult.success) {
        console.error("Membership creation failed:", membershipResult.error);
        return Response.json(
          { error: membershipResult.error || "Failed to create membership" },
          { status: 500 }
        );
      }
    }

    // ===== HANDLE PROFILE PHOTO & BUILD FACE CLUSTER =====
    if (photo) {
      try {
        const fileExt = "jpg"; // Convert profile photos to highly compressed JPEGs
        const fileName = `${userId}_${Date.now()}.${fileExt}`;
        const filePath = `visitors/${fileName}`;
        const rawBuffer = Buffer.from(await photo.arrayBuffer());

        // Compress profile photo significantly (faces don't need high res, 1080p max)
        const photoBuffer = await sharp(rawBuffer)
          .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();

        // Upload compressed photo to profile-photos bucket
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, photoBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(filePath);

          // Ensure a 'Profile Photos' event folder exists for storing the dummy references
          let { data: profileEvent } = await supabase.from("events").select("id").eq("slug", "profile-photos").maybeSingle();
          let eventId = profileEvent?.id;

          if (!eventId) {
            const { data: newEvent, error: eventErr } = await supabase.from("events").insert({
              title: "Profile Photos",
              slug: "profile-photos",
              description: "System bucket for user profiles",
              starts_at: new Date().toISOString(),
              is_public: false
            }).select("id").single();
            if (eventErr) console.error("Failed creating profile event container:", eventErr);
            eventId = newEvent?.id;
          }

          // Create a mock photo entry representing their face link
          if (eventId) {
            const { data: photoRecord, error: photoErr } = await supabase.from("photos").insert({
              event_id: eventId,
              path: urlData.publicUrl,
              bucket: "profile-photos"
            }).select("id").single();

            if (photoErr) console.error("Failed creating mock photo record:", photoErr);

            if (photoRecord) {
              const awsFaces = await indexFacesFromImageBytes({
                imageBytes: photoBuffer,
                externalImageId: String(photoRecord.id),
              });

              if (awsFaces.length > 0) {
                // Upsert visitor_profiles with the new amazon face ID!
                const { error: vpError } = await supabase.from("visitor_profiles").upsert({
                  user_id: userId,
                  full_name: fullName,
                  email: email,
                  profile_photo_url: urlData.publicUrl,
                  aws_face_id: awsFaces[0].awsFaceId,
                }, { onConflict: "user_id" });
                if (vpError) console.error("Visitor profile upsert error:", vpError);

                // Construct an anchor Face Cluster attached strictly to *this* user
                const { data: faceCluster, error: fcError } = await supabase.from("face_clusters").insert({
                  canonical_embedding: "[]",
                  face_count: 1,
                  user_id: userId, 
                  cover_photo_id: photoRecord.id,
                }).select("id").single();

                if (fcError) console.error("Face cluster insert error:", fcError);

                if (faceCluster) {
                  // Bind AWS Rekognition embedding to anchor cluster!
                  const { error: feError } = await supabase.from("face_embeddings").insert({
                    photo_id: photoRecord.id,
                    event_id: eventId,
                    embedding: "[]",
                    aws_face_id: awsFaces[0].awsFaceId,
                    bbox: awsFaces[0].bbox,
                    quality_score: awsFaces[0].qualityScore,
                    detection_method: "aws",
                    cluster_id: faceCluster.id,
                  });
                  if (feError) console.error("Face embedding insert error:", feError);
                }
              } else {
                console.error("No faces detected in the provided profile picture.");
              }
            }
          }
        } else {
          console.error("Failed to upload profile photo:", uploadError);
        }
      } catch (err) {
        console.error("Error setting up identity tagging:", err);
      }
    }

    // ===== MARK INVITATION AS USED =====
    if (invitationToken) {
      await supabase
        .from("invitations")
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .eq("token", invitationToken);
    }

    // ===== MARK OTP AS USED =====
    await markOTPAsUsed(email, otp);

    // ===== RESPONSE =====
    return Response.json(
      {
        success: true,
        message: "OTP verified successfully",
        userId,
        email,
        roleLevel,
        requiresSession: true, // Frontend should create session after this
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("OTP verification error:", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid request",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "OTP verification failed" },
      { status: 500 }
    );
  }
}

// Rate limit: 20 requests per minute per IP
export const POST = rateLimit(handler, rateLimitConfigs.strict);
