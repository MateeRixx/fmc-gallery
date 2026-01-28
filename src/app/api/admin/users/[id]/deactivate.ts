/**
 * API Route: POST /api/admin/users/[id]/deactivate
 * 
 * Mark a user as Inactive and revoke all their permissions
 * This is used when someone leaves the club mid-year
 * Their access is instantly revoked
 * 
 * Only Head and Co-Head can deactivate users
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireSupremeAdmin } from "@/lib/middleware";
import { UserRole, RoleChangeResponse } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Require Head or Co-Head
  const currentUser = await requireSupremeAdmin(request);
  if (currentUser instanceof Response) return currentUser;

  try {
    const userId = params.id;
    if (!userId) {
      return Response.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Can't deactivate self
    if (userId === currentUser.sub) {
      return Response.json(
        { error: "You cannot deactivate yourself" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the user being deactivated
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const previousRole = targetUser.role;

    // Mark as inactive and revoke all permissions
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        role: UserRole.INACTIVE,
        permissions: [],
        role_updated_at: new Date().toISOString(),
        role_updated_by: currentUser.sub,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (updateError || !updatedUser) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: "Failed to deactivate user" },
        { status: 500 }
      );
    }

    const response: RoleChangeResponse = {
      success: true,
      message: `Successfully deactivated ${targetUser.email}. All permissions revoked.`,
      user: updatedUser,
      previousRole,
      newRole: UserRole.INACTIVE,
    };

    return Response.json(response);
  } catch (err) {
    console.error("Error deactivating user:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
