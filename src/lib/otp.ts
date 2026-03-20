/**
 * OTP & Email Utilities
 * Handles OTP generation, email sending, and validation
 */

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { JWTPayload, UserRole } from "@/types";
import { createJWT } from "./jwt";
import crypto from "crypto";

// Initialize Resend with API key (use dummy key if not available - it will fail at runtime)
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_for_build");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const emailFrom = process.env.EMAIL_FROM?.trim() || "FMC Gallery <onboarding@resend.dev>";
const resendFallbackFrom = "FMC Gallery <onboarding@resend.dev>";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type EmailSendResult = {
  success: boolean;
  error?: string;
};

function formatResendError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown email provider error";
}

async function sendEmailWithFromAddress(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
}): Promise<EmailSendResult> {
  try {
    const response = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (response.error) {
      return {
        success: false,
        error: response.error.message || "Email provider rejected the request",
      };
    }

    if (!response.data?.id) {
      return {
        success: false,
        error: "Email provider did not return a message id",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatResendError(error),
    };
  }
}

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secure invitation token (32 chars)
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Send OTP email via Resend
 */
export async function sendOTPEmail(
  email: string,
  otp: string,
  fullName: string
): Promise<EmailSendResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to FMC Gallery!</h2>
      <p>Hi ${fullName},</p>
      <p>Your OTP verification code is:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <h1 style="letter-spacing: 5px; margin: 0; color: #FFBF00;">${otp}</h1>
      </div>
      <p><strong>This code expires in 10 minutes.</strong></p>
      <p>If you didn't request this code, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">FMC Gallery © 2024</p>
    </div>
  `;

  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: "RESEND_API_KEY is missing",
    };
  }

  const primaryAttempt = await sendEmailWithFromAddress({
    from: emailFrom,
    to: email,
    subject: "Your FMC Gallery OTP Verification Code",
    html,
  });

  if (primaryAttempt.success) {
    return primaryAttempt;
  }

  const usingFallbackAlready = emailFrom.includes("onboarding@resend.dev");
  if (!usingFallbackAlready) {
    const fallbackAttempt = await sendEmailWithFromAddress({
      from: resendFallbackFrom,
      to: email,
      subject: "Your FMC Gallery OTP Verification Code",
      html,
    });

    if (fallbackAttempt.success) {
      console.warn(
        `OTP email fallback sender used. Primary sender \"${emailFrom}\" failed with: ${primaryAttempt.error}`
      );
      return fallbackAttempt;
    }

    return {
      success: false,
      error: `Primary sender failed: ${primaryAttempt.error}. Fallback sender failed: ${fallbackAttempt.error}`,
    };
  }

  return primaryAttempt;
}

/**
 * Send invitation email via Resend
 */
export async function sendInvitationEmail(
  email: string,
  role: string,
  invitationToken: string,
  senderName: string
): Promise<boolean> {
  try {
    const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?invite=${invitationToken}`;

    const roleDisplayName = role === "co_head" ? "Co-Head" : role.charAt(0).toUpperCase() + role.slice(1);

    const response = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: `You're invited to FMC Gallery as ${roleDisplayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>FMC Gallery Invitation</h2>
          <p>Hi there,</p>
          <p><strong>${senderName}</strong> has invited you to join FMC Gallery as a <strong>${roleDisplayName}</strong>.</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 15px 0;">Click the button below to accept the invitation:</p>
            <a href="${signupUrl}" style="display: inline-block; padding: 12px 30px; background-color: #FFBF00; color: black; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          <p><strong>This invitation expires in 7 days.</strong></p>
          <p>If you did not expect this invitation, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">FMC Gallery © 2024</p>
        </div>
      `,
    });

    return !!response.data?.id;
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    return false;
  }
}

/**
 * Validate OTP and create user account
 */
export async function validateAndCreateUser(
  email: string,
  otpCode: string
): Promise<{ token: string; user: any } | null> {
  try {
    // Find OTP record
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("otp_code", otpCode)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (otpError || !otpData) {
      return null; // OTP not found, expired, or already used
    }

    // Check max attempts
    if (otpData.attempts >= otpData.max_attempts) {
      return null; // Too many failed attempts
    }

    // Get role default permissions
    const { data: roleDefaults } = await supabase
      .from("role_default_permissions")
      .select("permissions")
      .eq("role", otpData.role)
      .single();

    const permissions = roleDefaults?.permissions || [];

    // Create user account
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert([
        {
          email: otpData.email,
          full_name: otpData.full_name,
          role: otpData.role,
          permissions: permissions,
          is_verified: true,
          verified_at: new Date().toISOString(),
          ...(otpData.role === "head" && {
            tenure_start: new Date().toISOString(),
          }),
        },
      ])
      .select()
      .single();

    if (userError || !newUser) {
      return null;
    }

    // Mark OTP as used
    await supabase
      .from("otp_codes")
      .update({ is_used: true, verified_at: new Date().toISOString() })
      .eq("id", otpData.id);

    // Mark invitation token as used if present
    if (otpData.invitation_token_id) {
      await supabase
        .from("invitations")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("id", otpData.invitation_token_id);
    }

    // Create JWT token
    const jwtToken = createJWT({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role as UserRole,
      permissions: newUser.permissions || [],
    });

    return {
      token: jwtToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
      },
    };
  } catch (error) {
    console.error("Error validating OTP:", error);
    return null;
  }
}

/**
 * Increment OTP attempt counter
 */
export async function incrementOTPAttempts(email: string, otpCode: string): Promise<void> {
  try {
    const { data: otpData } = await supabase
      .from("otp_codes")
      .select("id, attempts")
      .eq("email", email)
      .eq("otp_code", otpCode)
      .single();

    if (otpData) {
      await supabase
        .from("otp_codes")
        .update({ attempts: (otpData.attempts || 0) + 1 })
        .eq("id", otpData.id);
    }
  } catch (error) {
    console.error("Error incrementing OTP attempts:", error);
  }
}

/**
 * Create and store invitation token
 */
export async function createAndSendInvitation(
  targetEmail: string,
  targetRole: "head" | "co_head" | "executive" | "member",
  createdById: string,
  senderName: string
): Promise<{ success: boolean; token?: string; message: string }> {
  try {
    const token = generateInvitationToken();

    // Create invitation record
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert([
        {
          token,
          email: targetEmail,
          role: targetRole,
          created_by: createdById,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError || !invitation) {
      return { success: false, message: "Failed to create invitation" };
    }

    // Send invitation email
    const emailSent = await sendInvitationEmail(
      targetEmail,
      targetRole,
      token,
      senderName
    );

    if (!emailSent) {
      // Clean up invitation if email fails
      await supabase.from("invitations").delete().eq("id", invitation.id);
      return { success: false, message: "Failed to send invitation email" };
    }

    return {
      success: true,
      token,
      message: `Invitation sent to ${targetEmail}`,
    };
  } catch (error) {
    console.error("Error creating invitation:", error);
    return { success: false, message: "Error creating invitation" };
  }
}

/**
 * Validate invitation token
 */
export async function validateInvitationToken(
  token: string
): Promise<{ valid: boolean; email?: string; role?: string; expiresAt?: string } | null> {
  try {
    const { data: invitation, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !invitation) {
      return null; // Invalid or expired token
    }

    return {
      valid: true,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expires_at,
    };
  } catch (error) {
    console.error("Error validating invitation token:", error);
    return null;
  }
}

/**
 * Store OTP code in database
 */
export async function storeOTP(
  email: string,
  otpCode: string,
  fullName: string,
  role: "head" | "co_head" | "executive" | "member",
  invitationTokenId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("otp_codes").insert([
      {
        email,
        otp_code: otpCode,
        full_name: fullName,
        role,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        invitation_token_id: invitationTokenId || null,
      },
    ]);

    return !error;
  } catch (error) {
    console.error("Error storing OTP:", error);
    return false;
  }
}
