/**
 * API Route: POST /api/admin/invites/send
 *
 * Send invitation to new member
 * Creates invite token and sends via email
 * Only CO_HEAD+ can send invites
 */

import { requireCoHead } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";
import { sendInvitationEmail } from "@/lib/email";
import { canAssignRole } from "@/lib/membership-utils";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SendInviteSchema = z.object({
  email: z.string().email(),
  role_level: z.number().min(0).max(3),
});

export async function POST(request: Request) {
  try {
    const user = await requireCoHead();

    const body = await request.json();
    const validated = SendInviteSchema.parse(body);
    const email = validated.email.toLowerCase().trim();
    const roleLevel = validated.role_level;

    // Check if requester can invite this role
    const canInvite = await canAssignRole(user.id, roleLevel);
    if (!canInvite) {
      return Response.json(
        { error: "You cannot invite members with this role" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if user already exists and is active
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return Response.json(
        { error: "User already exists with this email" },
        { status: 409 }
      );
    }

    // Create invitation token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const roleMap: Record<number, string> = {
      1: "executive",
      2: "co_head",
      3: "head",
    };

    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        token,
        email,
        role: roleMap[roleLevel] || "executive",
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      })
      .select("id")
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      return Response.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Send email
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const originUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;

    const emailResult = await sendInvitationEmail({
      to: email,
      invitationToken: token,
      role: roleMap[roleLevel] || "executive",
      invitedBy: user.email || "Admin",
      baseUrl: originUrl,
    });

    if (!emailResult.success) {
      console.warn(`Failed to send invite email to ${email}`, emailResult.error);
      // Still return success - invitation is stored
    }

    return Response.json(
      {
        success: true,
        message: "Invitation sent successfully",
        token,
        email,
        role_level: roleLevel,
        email_sent: emailResult.success,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/admin/invites/send:", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    return Response.json(
      { error: error.message || "Failed to send invitation" },
      { status: error.statusCode || 500 }
    );
  }
}
