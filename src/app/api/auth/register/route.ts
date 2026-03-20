/**
 * API Route: POST /api/auth/register
 *
 * Register a new user and send OTP verification email
 * - Executive/Member: Public signup (no invitation required)
 * - Head/Co-Head: Requires valid invitation token
 */

import { createClient } from "@supabase/supabase-js";
import { generateOTP, storeOTP, sendOTPEmail, validateInvitationToken } from "@/lib/otp";
import { MASTER_EMAIL } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, full_name, role, invitation_token } = body;

    // ===== VALIDATION =====
    if (!email || typeof email !== "string") {
      return Response.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!full_name || typeof full_name !== "string") {
      return Response.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    if (!role || typeof role !== "string") {
      return Response.json(
        { error: "Role is required" },
        { status: 400 }
      );
    }

    const normalized_email = email.toLowerCase().trim();
    const normalized_role = role.toLowerCase();

    // Valid roles
    const valid_roles = ["head", "co_head", "executive", "member"];
    if (!valid_roles.includes(normalized_role)) {
      return Response.json(
        { error: "Invalid role. Must be: head, co_head, executive, or member" },
        { status: 400 }
      );
    }

    // Email validation
    if (!normalized_email.includes("@")) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // ===== SECURITY CHECK: Head/Co-Head require invitation (EXCEPT MASTER) =====
    const isMaster = normalized_email === MASTER_EMAIL.toLowerCase();

    if ((normalized_role === "head" || normalized_role === "co_head") && !isMaster) {
      if (!invitation_token) {
        return Response.json(
          { error: `${normalized_role === "head" ? "Head" : "Co-Head"} role requires invitation token` },
          { status: 403 }
        );
      }

      // Validate invitation token
      const inviteValidation = await validateInvitationToken(invitation_token);
      if (!inviteValidation || !inviteValidation.valid) {
        return Response.json(
          { error: "Invalid or expired invitation token" },
          { status: 403 }
        );
      }

      // Verify token email matches signup email
      if (inviteValidation.email?.toLowerCase() !== normalized_email) {
        return Response.json(
          { error: "Invitation email does not match signup email" },
          { status: 403 }
        );
      }

      // Verify token is for matching role
      if (inviteValidation.role !== normalized_role) {
        return Response.json(
          { error: `Invitation is for ${inviteValidation.role} role, not ${normalized_role}` },
          { status: 403 }
        );
      }
    }

    // ===== CHECK IF USER ALREADY EXISTS =====
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data: existing_user, error: lookup_error } = await supabase
        .from("users")
        .select("id, is_verified")
        .eq("email", normalized_email)
        .maybeSingle();

      if (lookup_error) {
        console.error("Database error:", lookup_error);
        return Response.json(
          { error: "Database error" },
          { status: 500 }
        );
      }

      if (existing_user?.is_verified) {
        return Response.json(
          { error: "Email already registered and verified" },
          { status: 409 }
        );
      }
    }

    // ===== GENERATE & STORE OTP =====
    const otp = generateOTP();
    console.log(`📧 Generated OTP for ${normalized_email}: ${otp}`);

    // Store invitation token ID if provided
    let invitation_token_id: string | undefined;
    if (invitation_token && supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: inv_data } = await supabase
        .from("invitations")
        .select("id")
        .eq("token", invitation_token)
        .single();

      invitation_token_id = inv_data?.id;
    }

    // Store OTP in database
    const otp_stored = await storeOTP(
      normalized_email,
      otp,
      full_name,
      normalized_role as "head" | "co_head" | "executive" | "member",
      invitation_token_id
    );

    if (!otp_stored) {
      return Response.json(
        { error: "Failed to store OTP" },
        { status: 500 }
      );
    }

    // ===== SEND OTP EMAIL =====
    const email_result = await sendOTPEmail(normalized_email, otp, full_name);

    if (!email_result.success) {
      console.error("OTP email send failed:", email_result.error);
      const details = email_result.error ? ` Details: ${email_result.error}` : "";
      return Response.json(
        {
          error:
            `Failed to send OTP email. Email provider is not configured correctly.${details}`,
          details: email_result.error,
        },
        { status: 500 }
      );
    }

    // ===== SUCCESS RESPONSE =====
    return Response.json({
      success: true,
      message: "OTP sent to email. Check spam folder if not found.",
      email: normalized_email,
      role: normalized_role,
      expires_in: "10 minutes",
    });

  } catch (err) {
    console.error("Registration error:", err);
    return Response.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
