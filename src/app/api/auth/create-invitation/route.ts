/**
 * API Route: POST /api/auth/create-invitation
 *
 * Create and send invitation token for admin roles
 * Requires authentication (Bearer token) and appropriate role
 * - MASTER/HEAD: Can invite Head, Co-Head, Executive, Member
 * - CO_HEAD: Can only invite Executive, Member (NOT Co-Head)
 * - Others: Cannot invite anyone
 */

import { verifyJWT, extractTokenFromHeader } from "@/lib/jwt";
import { canInviteRole } from "@/lib/roleDefaults";
import { createAndSendInvitation } from "@/lib/otp";
import { UserRole } from "@/types";

export async function POST(request: Request) {
  try {
    // ===== AUTHENTICATION =====
    const auth_header = request.headers.get("authorization");
    const token = extractTokenFromHeader(auth_header);

    if (!token) {
      return Response.json(
        { error: "Authorization header required (Bearer token)" },
        { status: 401 }
      );
    }

    const decoded = verifyJWT(token);
    if (!decoded) {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const requester_email = decoded.email;
    const requester_role = decoded.role as UserRole;

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
    const invitation = await createAndSendInvitation(
      normalized_email,
      normalized_role as "head" | "co_head" | "executive" | "member",
      decoded.sub,
      decoded.email.split("@")[0] // Use email prefix as display name
    );

    if (!invitation.success) {
      return Response.json(
        { error: invitation.message },
        { status: 500 }
      );
    }

    // ===== SUCCESS RESPONSE =====
    return Response.json({
      success: true,
      message: invitation.message,
      token: invitation.token,
      email: normalized_email,
      role: normalized_role,
      expires_in: "7 days",
    });

  } catch (err) {
    console.error("Invitation creation error:", err);
    return Response.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
