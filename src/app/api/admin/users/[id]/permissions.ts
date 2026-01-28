/**
 * API Route: POST /api/admin/users/[id]/role
 * 
 * Change a user's role
 * Only Head and Co-Head can perform this action
 * 
 * IMPORTANT: When promoting someone to Head, automatically demote the current Head to Executive
 * Same logic applies for Co-Head
 * 
 * Yearly Handover Example:
 * - Old Co-Head becomes new Head: PATCH /api/admin/users/oldCoHeadId/role { newRole: "head" }
 * - Old Executive becomes new Co-Head: PATCH /api/admin/users/executiveId/role { newRole: "co_head" }
 * - New Executives are added: POST /api/admin/users { email: "newperson@example.com", role: "executive" }
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireSupremeAdmin } from "@/lib/middleware";
import { User, UserRole, RoleChangeResponse } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params (Next.js 15+ requirement)
  const { id: userId } = await params;

  // Require Head or Co-Head
  const currentUser = await requireSupremeAdmin(request);
  if (currentUser instanceof Response) return currentUser;

  try {
    const body = await request.json();
    const { newRole } = body;

    if (!newRole || !Object.values(UserRole).includes(newRole)) {
      return Response.json(
        { error: "Invalid newRole. Must be one of: head, co_head, executive, member, inactive" },
        { status: 400 }
      );
    }

    if (!userId) {
      return Response.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the user being promoted/demoted
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

    // Handle role conflicts (only 1 Head and 1 Co-Head allowed)
    if (newRole === UserRole.HEAD) {
      // Demote current Head to Executive
      const { data: currentHead } = await supabase
        .from("users")
        .select("id")
        .eq("role", UserRole.HEAD)
        .neq("id", userId)
        .maybeSingle();

      if (currentHead) {
        await supabase
          .from("users")
          .update({
            role: UserRole.EXECUTIVE,
            role_updated_at: new Date().toISOString(),
            role_updated_by: currentUser.sub,
          })
          .eq("id", currentHead.id);
      }
    } else if (newRole === UserRole.CO_HEAD) {
      // Demote current Co-Head to Executive
      const { data: currentCoHead } = await supabase
        .from("users")
        .select("id")
        .eq("role", UserRole.CO_HEAD)
        .neq("id", userId)
        .maybeSingle();

      if (currentCoHead) {
        await supabase
          .from("users")
          .update({
            role: UserRole.EXECUTIVE,
            role_updated_at: new Date().toISOString(),
            role_updated_by: currentUser.sub,
          })
          .eq("id", currentCoHead.id);
      }
    }

    // Update the target user's role
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        role: newRole,
        role_updated_at: new Date().toISOString(),
        role_updated_by: currentUser.sub,
        // Reset permissions when changing role (they'll be set per-role)
        permissions: [],
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (updateError || !updatedUser) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: "Failed to update user role" },
        { status: 500 }
      );
    }

    const response: RoleChangeResponse = {
      success: true,
      message: `Successfully changed role from ${previousRole} to ${newRole}`,
      user: updatedUser,
      previousRole,
      newRole,
    };

    return Response.json(response);
  } catch (err) {
    console.error("Error changing user role:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}