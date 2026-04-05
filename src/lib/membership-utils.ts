/**
 * Membership Utility Functions
 * Handles role determination, membership status, and lifecycle
 */

import { createClient } from "@supabase/supabase-js";

// Role level constants
export const ROLE_LEVELS = {
  VISITOR: 0,
  EXECUTIVE: 1,
  CO_HEAD: 2,
  HEAD: 3,
} as const;

export const ROLE_LEVEL_NAMES: Record<number, string> = {
  0: "VISITOR",
  1: "EXECUTIVE",
  2: "CO_HEAD",
  3: "HEAD",
};

/**
 * Get user's active membership and role level
 * Returns null if user has no active membership (is VISITOR)
 */
export async function getUserMembership(userId: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("memberships")
      .select("id, user_id, role_level, is_active, start_date, end_date")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching membership:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getUserMembership:", error);
    return null;
  }
}

/**
 * Get user's role level (0-3)
 * Returns 0 (VISITOR) if no active membership
 */
export async function getUserRoleLevel(userId: string): Promise<number> {
  const membership = await getUserMembership(userId);
  return membership?.role_level ?? ROLE_LEVELS.VISITOR;
}

/**
 * Get user's role name
 */
export async function getUserRoleString(userId: string): Promise<string> {
  const roleLevel = await getUserRoleLevel(userId);
  return ROLE_LEVEL_NAMES[roleLevel] || "VISITOR";
}

/**
 * Create or activate membership for a user
 */
export async function createMembership(
  userId: string,
  roleLevel: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: "Database not configured" };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if membership exists
    const { data: existing, error: checkError } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking membership:", checkError);
      return { success: false, error: "Database error" };
    }

    if (existing) {
      // Update existing membership
      const { error: updateError } = await supabase
        .from("memberships")
        .update({
          role_level: roleLevel,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating membership:", updateError);
        return { success: false, error: "Failed to update membership" };
      }
    } else {
      // Create new membership
      const { error: insertError } = await supabase
        .from("memberships")
        .insert({
          user_id: userId,
          role_level: roleLevel,
          is_active: true,
          start_date: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Error creating membership:", insertError);
        return { success: false, error: "Failed to create membership" };
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error in createMembership:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Deactivate user membership
 */
export async function deactivateMembership(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: "Database not configured" };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase
      .from("memberships")
      .update({
        is_active: false,
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Error deactivating membership:", error);
      return { success: false, error: "Failed to deactivate membership" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deactivateMembership:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Check if user can manage another user
 * Admins can manage lower roles
 */
export async function canManageUser(
  requesterId: string,
  targetId: string
): Promise<boolean> {
  try {
    const requesterLevel = await getUserRoleLevel(requesterId);
    const targetLevel = await getUserRoleLevel(targetId);

    // HEAD can manage everyone (>= because HEAD is 3)
    if (requesterLevel === ROLE_LEVELS.HEAD) {
      return targetLevel < ROLE_LEVELS.HEAD;
    }

    // CO_HEAD can manage EXECUTIVE and below
    if (requesterLevel === ROLE_LEVELS.CO_HEAD) {
      return targetLevel < ROLE_LEVELS.CO_HEAD;
    }

    // Others cannot manage anyone
    return false;
  } catch (error) {
    console.error("Error in canManageUser:", error);
    return false;
  }
}

/**
 * Check if user can assign specific role
 */
export async function canAssignRole(
  requesterId: string,
  targetRoleLevel: number
): Promise<boolean> {
  try {
    const requesterLevel = await getUserRoleLevel(requesterId);

    // HEAD can assign any role
    if (requesterLevel === ROLE_LEVELS.HEAD) {
      return true;
    }

    // CO_HEAD can assign up to CO_HEAD level (2) but not HEAD
    if (requesterLevel === ROLE_LEVELS.CO_HEAD) {
      return targetRoleLevel < ROLE_LEVELS.HEAD;
    }

    // Others cannot assign roles
    return false;
  } catch (error) {
    console.error("Error in canAssignRole:", error);
    return false;
  }
}

/**
 * Check if there's a HEAD user
 */
export async function hasHead(): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return false;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("memberships")
      .select("id")
      .eq("role_level", ROLE_LEVELS.HEAD)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      console.error("Error checking for HEAD:", error);
      return false;
    }

    return !!data && data.length > 0;
  } catch (error) {
    console.error("Error in hasHead:", error);
    return false;
  }
}

/**
 * Get the current HEAD user
 */
export async function getHeadUser() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("role_level", ROLE_LEVELS.HEAD)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Get user details
    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("id", data.user_id)
      .maybeSingle();

    return user;
  } catch (error) {
    console.error("Error in getHeadUser:", error);
    return null;
  }
}

/**
 * Transfer HEAD role to another user
 * Only callable by current HEAD
 */
export async function transferHead(
  currentHeadId: string,
  newHeadId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: "Database not configured" };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify current user is HEAD
    const currentLevel = await getUserRoleLevel(currentHeadId);
    if (currentLevel !== ROLE_LEVELS.HEAD) {
      return { success: false, error: "Only HEAD can transfer HEAD role" };
    }

    // Deactivate current HEAD membership
    const { error: deactivateError } = await supabase
      .from("memberships")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", currentHeadId);

    if (deactivateError) {
      console.error("Error deactivating current HEAD:", deactivateError);
      return {
        success: false,
        error: "Failed to deactivate current HEAD",
      };
    }

    // Activate or create HEAD membership for new user
    const createResult = await createMembership(newHeadId, ROLE_LEVELS.HEAD);
    if (!createResult.success) {
      return createResult;
    }

    return { success: true };
  } catch (error) {
    console.error("Error in transferHead:", error);
    return { success: false, error: "Internal server error" };
  }
}
