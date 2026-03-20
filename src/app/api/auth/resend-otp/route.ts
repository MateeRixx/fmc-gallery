/**
 * API Route: POST /api/auth/resend-otp
 *
 * Resend OTP code to user email
 * Can be called when OTP expires or user requests to resend
 */

import { createClient } from "@supabase/supabase-js";
import { generateOTP, sendOTPEmail } from "@/lib/otp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // ===== VALIDATION =====
    if (!email || typeof email !== "string") {
      return Response.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalized_email = email.toLowerCase().trim();

    if (!normalized_email.includes("@")) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // ===== CHECK DATABASE =====
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the latest pending OTP for this email
    const { data: existing_otps, error: lookup_error } = await supabase
      .from("otp_codes")
      .select("id, full_name, role, attempts")
      .eq("email", normalized_email)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (lookup_error) {
      console.error("Database error:", lookup_error);
      return Response.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    // No pending OTP found
    if (!existing_otps || existing_otps.length === 0) {
      return Response.json(
        { error: "No pending registration found. Please start registration again." },
        { status: 404 }
      );
    }

    const existing_otp = existing_otps[0];
    const full_name = existing_otp.full_name;
    const role = existing_otp.role;

    // Check if user exceeded max attempts
    if (existing_otp.attempts >= 5) {
      return Response.json(
        { error: "Maximum OTP attempts exceeded. Please contact support." },
        { status: 429 }
      );
    }

    // ===== GENERATE NEW OTP =====
    const new_otp = generateOTP();
    console.log(`📧 Resending OTP for ${normalized_email}: ${new_otp}`);

    // ===== DELETE OLD OTP & CREATE NEW ONE =====
    // Delete old OTP record
    const { error: delete_error } = await supabase
      .from("otp_codes")
      .delete()
      .eq("id", existing_otp.id);

    if (delete_error) {
      console.error("Error deleting old OTP:", delete_error);
      return Response.json(
        { error: "Failed to process resend" },
        { status: 500 }
      );
    }

    // Create new OTP record
    const { error: insert_error } = await supabase
      .from("otp_codes")
      .insert([
        {
          email: normalized_email,
          otp_code: new_otp,
          full_name: full_name,
          role: role,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          attempts: 0,
          max_attempts: 5,
          is_used: false,
        },
      ]);

    if (insert_error) {
      console.error("Error creating new OTP:", insert_error);
      return Response.json(
        { error: "Failed to generate new OTP" },
        { status: 500 }
      );
    }

    // ===== SEND OTP EMAIL =====
    const email_result = await sendOTPEmail(normalized_email, new_otp, full_name);

    if (!email_result.success) {
      console.error("Resend OTP email failed:", email_result.error);
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
      message: "New OTP sent to email",
      email: normalized_email,
      expires_in: "10 minutes",
    });

  } catch (err) {
    console.error("Resend OTP error:", err);
    return Response.json(
      { error: "Failed to resend OTP" },
      { status: 500 }
    );
  }
}
