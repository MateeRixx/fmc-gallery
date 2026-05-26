/**
 * API Route: POST /api/admin/members/[id]/deactivate
 *
 * Deactivate member account
 * Sets is_active = false
 * Accessible to ADMIN+ (CO_HEAD and HEAD)
 */

import { requireAdmin, ForbiddenError } from "@/lib/auth-utils";
import { createClient } from "@supabase/supabase-js";
import { canManageUser, getUserRoleLevel, ROLE_LEVELS } from "@/lib/membership-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const targetId = id;

    // Prevent self-deactivation
    if (user.id === targetId) {
      throw new ForbiddenError("Cannot deactivate your own account");
    }

    // Check if requester can manage this user
    const canManage = await canManageUser(user.id, targetId);
    if (!canManage) {
      throw new ForbiddenError("You cannot manage this user");
    }

    // Prevent CO_HEAD from deactivating HEAD
    const targetLevel = await getUserRoleLevel(targetId);
    const requesterLevel = await getUserRoleLevel(user.id);

    if (targetLevel === ROLE_LEVELS.HEAD && requesterLevel !== ROLE_LEVELS.HEAD) {
      throw new ForbiddenError("Only HEAD can deactivate another HEAD");
    }

    const supabase = getSupabaseAdmin();

    // Deactivate membership
    const { error } = await supabase
      .from("memberships")
      .update({
        is_active: false,
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", targetId);

    if (error) {
      console.error("Error deactivating member:", error);
      return Response.json(
        { error: "Failed to deactivate member" },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Member deactivated successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/admin/members/[id]/deactivate:", error);
    return Response.json(
      { error: error.message || "Deactivation failed" },
      { status: error.statusCode || 500 }
    );
  }
}
ber deactivated successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/admin/members/[id]/deactivate:", error);
    return Response.json(
      { error: error.message || "Deactivation failed" },
      { status: error.statusCode || 500 }
    );
  }
}
