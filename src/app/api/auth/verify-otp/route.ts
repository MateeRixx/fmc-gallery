/**
 * API Route: POST /api/auth/verify-otp
 *
 * Verify OTP code and create user account
 * Returns JWT token on successful verification
 */

import { createClient } from "@supabase/supabase-js";
import { validateAndCreateUser, incrementOTPAttempts } from "@/lib/otp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp_code } = body;

    // ===== VALIDATION =====
    if (!email || typeof email !== "string") {
      return Response.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!otp_code || typeof otp_code !== "string") {
      return Response.json(
        { error: "OTP code is required" },
        { status: 400 }
      );
    }

    const normalized_email = email.toLowerCase().trim();
    const otp_trimmed = otp_code.trim();

    // OTP must be 6 digits
    if (!/^\d{6}$/.test(otp_trimmed)) {
      return Response.json(
        { error: "OTP must be 6 digits" },
        { status: 400 }
      );
    }

    // ===== CHECK OTP STATUS =====
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get OTP record
    const { data: otp_data, error: otp_error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", normalized_email)
      .eq("otp_code", otp_trimmed)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (otp_error || !otp_data) {
      console.log("❌ OTP not found or expired:", { email: normalized_email, error: otp_error });
      return Response.json(
        { error: "OTP not found, expired, or already used" },
        { status: 401 }
      );
    }

    // ===== CHECK MAX ATTEMPTS =====
    if (otp_data.attempts >= otp_data.max_attempts) {
      return Response.json(
        { error: `Too many failed attempts. Max attempts (${otp_data.max_attempts}) exceeded.` },
        { status: 429 }
      );
    }

    // ===== VALIDATE & CREATE USER =====
    const result = await validateAndCreateUser(normalized_email, otp_trimmed);

    if (!result) {
      // Increment failed attempts
      await incrementOTPAttempts(normalized_email, otp_trimmed);

      return Response.json(
        { error: "OTP verification failed. Invalid OTP or user creation error." },
        { status: 401 }
      );
    }

    // ===== SUCCESS: USER CREATED =====
    console.log(`✅ User created successfully: ${normalized_email} (${otp_data.role})`);

    return Response.json({
      success: true,
      message: "Account created successfully",
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.full_name,
        role: result.user.role,
      },
    });

  } catch (err) {
    console.error("OTP verification error:", err);
    return Response.json(
      { error: "OTP verification failed" },
      { status: 500 }
    );
  }
}
