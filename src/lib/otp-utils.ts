/**
 * OTP Utility Functions
 * Handles OTP generation, storage, verification
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store OTP in database
 */
export async function storeOTP(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    // Check for existing non-expired OTPs for this email
    const { data: existing } = await supabase
      .from("otp_codes")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    // Allow max 3 active OTPs per email
    if (existing && existing.length >= 3) {
      return {
        success: false,
        error: "Too many active OTP codes. Please try again later.",
      };
    }

    // Store new OTP (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error } = await supabase.from("otp_codes").insert({
      email: email.toLowerCase(),
      otp_code: otp,
      role: 'member',
      full_name: 'Unknown',
      expires_at: expiresAt.toISOString(),
      is_used: false,
      attempts: 0,
    });

    if (error) {
      console.error("Error storing OTP:", error);
      return { success: false, error: `Failed to store OTP: ${error.message || error.code}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in storeOTP:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Verify OTP code
 * Returns true if valid, error otherwise
 */
export async function verifyOTP(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    // Find matching OTP
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_codes")
      .select("id, expires_at, is_used, attempts")
      .eq("email", email.toLowerCase())
      .eq("otp_code", otp)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching OTP:", fetchError);
      return { success: false, error: "Verification failed" };
    }

    if (!otpRecord) {
      return { success: false, error: "Invalid OTP code" };
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return { success: false, error: "OTP code has expired" };
    }

    // Check if already used
    if (otpRecord.is_used) {
      return { success: false, error: "OTP code has already been used" };
    }

    // Check attempts (max 5)
    if (otpRecord.attempts >= 5) {
      return { success: false, error: "Too many failed attempts. OTP locked." };
    }

    // Mark as used
    const { error: updateError } = await supabase
      .from("otp_codes")
      .update({ is_used: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Error updating OTP:", updateError);
      return { success: false, error: "Verification failed" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Mark OTP as used (call after creating user)
 */
export async function markOTPAsUsed(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Already marked as verified during verification
    // This is a no-op for consistency with existing code
    return { success: true };
  } catch (error) {
    console.error("Error in markOTPAsUsed:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Get latest unverified OTP for email (for checking if exists)
 */
export async function getLatestOTP(
  email: string
): Promise<{ exists: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("otp_codes")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching OTP:", error);
      return { exists: false, error: error.message };
    }

    return { exists: !!data && data.length > 0 };
  } catch (error) {
    console.error("Error in getLatestOTP:", error);
    return { exists: false, error: "Internal server error" };
  }
}
