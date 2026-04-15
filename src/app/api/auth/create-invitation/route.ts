/**
 * API Route: POST /api/auth/create-invitation
 *
 * Create and send invitation token for admin roles
 * Requires authentication and appropriate role
 * - MASTER/HEAD: Can invite Head, Co-Head, Executive, Member
 * - CO_HEAD: Can only invite Executive, Member (NOT Co-Head)
 * - Others: Cannot invite anyone
 */

import { requireAuth } from "@/lib/auth-utils";
import { canInviteRole } from "@/lib/roleDefaults";
import { createClient } from "@supabase/supabase-js";
import { UserRole } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { sendInvitationEmail } from "@/lib/email";

// Helper function to create and send invitation (replaces createAndSendInvitation from otp.ts)
async function createAndSendInvitation(
  target_email: string,
  target_role: string,
  requester_email: string,
  baseUrl?: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: "Database not configured" };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const token = uuidv4();
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      token,
      email: target_email,
      role: target_role,
      created_by: requester_email,
      expires_at: expires_at.toISOString(),
      is_used: false,
    })
    .select("token")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Send invitation email via Resend
  const emailResult = await sendInvitationEmail({
    to: target_email,
    invitationToken: data.token,
    role: target_role,
    invitedBy: requester_email,
    baseUrl,
  });

  if (!emailResult.success) {
    console.error('Failed to send invitation email:', emailResult.error);
    // Note: We don't fail the invitation creation if email fails
    // The invitation is still valid and can be used manually
  }

  return { 
    success: true, 
    token: data.token,
    emailSent: emailResult.success,
  };
}

export async function POST(request: Request) {
  try {
    // ===== AUTHENTICATION =====
    const user = await requireAuth();

    const requester_email = user.email;
    const requester_role = user.role as UserRole;

    // ===== VALIDATION =====
    const body = await request.json();
    const { target_email, target_role } = body;

    if (!target_email || typeof target_email !== "string") {
      return Response.json(
        { error: "Target email is required" },
        { status: 400 }
      );
    }

    if (!target_role || typeof target_role !== "string") {
      return Response.json(
        { error: "Target role is required" },
        { status: 400 }
      );
    }

    const normalized_email = target_email.toLowerCase().trim();
    const normalized_role = target_role.toLowerCase();

    // Validate target role
    const valid_roles = ["head", "co_head", "executive", "member"];
    if (!valid_roles.includes(normalized_role)) {
      return Response.json(
        { error: "Invalid role. Must be: head, co_head, executive, or member" },
        { status: 400 }
      );
    }

    if (!normalized_email.includes("@")) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // ===== PERMISSION CHECK =====
    // Map string role to UserRole enum for type safety
    const targetRoleEnum = Object.values(UserRole).includes(normalized_role as UserRole)
      ? (normalized_role as UserRole)
      : UserRole.MEMBER;

    // Check if requester can invite this role
    const can_invite = canInviteRole(requester_role, targetRoleEnum);

    if (!can_invite) {
      return Response.json(
        {
          error: `Your role (${requester_role}) cannot invite ${normalized_role}. ` +
                 (normalized_role === "head"
                   ? "Only MASTER can invite new Heads."
                   : normalized_role === "co_head"
                   ? "Only MASTER can invite Co-Heads."
                   : "Check your role permissions.")
        },
        { status: 403 }
      );
    }

    console.log(`📧 Creating invitation: ${requester_email} (${requester_role}) → ${normalized_email} (${normalized_role})`);

    // ===== CREATE & SEND INVITATION =====
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const originUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;

    const invitation = await createAndSendInvitation(
      normalized_email,
      normalized_role as "head" | "co_head" | "executive" | "member",
      requester_email,
      originUrl
    );

    if (!invitation.success) {
      return Response.json(
        { error: invitation.error },
        { status: 500 }
      );
    }

    // ===== SUCCESS RESPONSE =====
    return Response.json({
      success: true,
      token: invitation.token,
      email: normalized_email,
      role: normalized_role,
      expires_in: "7 days",
      emailSent: invitation.emailSent || false,
    });

  } catch (err) {
    console.error("Invitation creation error:", err);
    return Response.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
