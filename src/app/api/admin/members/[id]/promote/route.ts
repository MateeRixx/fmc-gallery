/**
 * API Route: POST /api/admin/members/[id]/promote
 *
 * Promote member to higher role
 * HEAD can promote to any level
 * CO_HEAD can promote to EXECUTIVE or CO_HEAD
 */

import { requireAdmin, requireHead } from "@/lib/auth-utils";
import { createClient } from "@supabase/supabase-js";
import {
  createMembership,
  canAssignRole,
  ROLE_LEVELS,
  getUserRoleLevel,
} from "@/lib/membership-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const targetId = id;

    // Parse body
    const body = await request.json();
    const { role_level } = body;

    if (typeof role_level !== "number" || role_level < 0 || role_level > 3) {
      return Response.json(
        { error: "Invalid role level (0-3)" },
        { status: 400 }
      );
    }

    // Check if requester can assign this role
    const canAssign = await canAssignRole(user.id, role_level);
    if (!canAssign) {
      return Response.json(
        { error: "You cannot assign this role" },
        { status: 403 }
      );
    }

    // Prevent promoting to HEAD unless you are HEAD
    if (role_level === ROLE_LEVELS.HEAD) {
      const requesterLevel = await getUserRoleLevel(user.id);
      if (requesterLevel !== ROLE_LEVELS.HEAD) {
        return Response.json(
          { error: "Only HEAD can assign HEAD role" },
          { status: 403 }
        );
      }
    }

    // Create or update membership
    const result = await createMembership(targetId, role_level);
    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        message: `Member promoted to role level ${role_level}`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/admin/members/[id]/promote:", error);
    return Response.json(
      { error: error.message || "Promotion failed" },
      { status: error.statusCode || 500 }
    );
  }
}
