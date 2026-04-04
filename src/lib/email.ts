/**
 * Email Utility - Send OTP, Invitations, and other notifications via Resend
 * Replaces old SMTP-based email with Resend API
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || "auth@fmcgallery.com";

/**
 * Send OTP via email
 */
export async function sendOTPEmail(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your FMC Gallery Login Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to FMC Gallery</h2>
          <p>Your one-time password (OTP) is:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; margin: 0; color: #333; font-size: 32px;">${otp}</h1>
          </div>
          <p style="color: #666;">This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Resend API error:", result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send invitation email to new members
 */
export async function sendInvitationEmail({
  to,
  invitationToken,
  role,
  invitedBy,
}: {
  to: string;
  invitationToken: string;
  role: string;
  invitedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${invitationToken}`;
    const roleDisplay =
      role === "head"
        ? "Head"
        : role === "co_head"
          ? "Co-Head"
          : "Executive";

    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `You're invited to join FMC Gallery as ${roleDisplay}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You're Invited!</h2>
          <p>Hi there,</p>
          <p><strong>${invitedBy}</strong> has invited you to join <strong>FMC Gallery</strong> as a <strong>${roleDisplay}</strong>.</p>
          <p style="margin: 30px 0;">
            <a href="${inviteLink}" style="background: #4F46E5; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">Or copy this link: <br/><code style="word-break: break-all;">${inviteLink}</code></p>
          <p style="color: #666; font-size: 12px;">This invitation expires in 7 days.</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Resend API error:", result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send email confirmation (for other purposes)
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error("Resend API error:", result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
