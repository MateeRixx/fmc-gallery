/**
 * API Route: POST /api/admin/users/[id]/permissions
 * 
 * Grant or revoke specific permissions for an Executive
 * Only Head and Co-Head can perform this action
 * 
 * Request body:
 * {
 *   "permissions": ["canAddEvents", "canUploadPhotos", ...],
 *   "action": "set" | "grant" | "revoke"
 * }
 * 
 * - "set": Replace all permissions with the provided list
 * - "grant": Add permissions from the list
 * - "revoke": Remove permissions from the list
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireSupremeAdmin } from "@/lib/middleware";
import { User, Permission, UserRole, PermissionChangeResponse } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Require Head or Co-Head
  const currentUser = await requireSupremeAdmin(request);
  if (currentUser instanceof Response) return currentUser;

  try {
    const body = await request.json();
    const { permissions, action } = body;

    if (!Array.isArray(permissions)) {
      return Response.json(
        { error: "permissions must be an array" },
        { status: 400 }
      );
    }

    if (!["set", "grant", "revoke"].includes(action)) {
      return Response.json(
        { error: 'action must be "set", "grant", or "revoke"' },
        { status: 400 }
      );
    }

    const userId = params.id;
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

    // Get the target user
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

    // Can only manage permissions for Executives
    if (targetUser.role !== UserRole.EXECUTIVE) {
      return Response.json(
        { error: "Can only manage permissions for Executives. Head/Co-Head have all permissions implicitly." },
        { status: 400 }
      );
    }

    let newPermissions: Permission[] = targetUser.permissions || [];

    if (action === "set") {
      // Replace all permissions
      newPermissions = permissions;
    } else if (action === "grant") {
      // Add permissions
      newPermissions = Array.from(new Set([...newPermissions, ...permissions]));
    } else if (action === "revoke") {
      // Remove permissions
      newPermissions = newPermissions.filter((p: Permission) => !permissions.includes(p));
    }

    // Update user permissions
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        permissions: newPermissions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (updateError || !updatedUser) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: "Failed to update permissions" },
        { status: 500 }
      );
    }

    const response: PermissionChangeResponse = {
      success: true,
      message: `Successfully ${action}ed permissions for ${targetUser.email}`,
      user: updatedUser,
      permissions: newPermissions,
    };

    return Response.json(response);
  } catch (err) {
    console.error("Error updating permissions:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
