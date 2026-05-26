/**
 * API Route: GET /api/admin/invitations
 *
 * Get list of invitations created by the current user
 * Requires authentication
 */

import { requireAuth } from "@/lib/auth-utils";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    // ===== AUTHENTICATION =====
    const user = await requireAuth();

    // ===== GET INVITATIONS =====
    const supabase = getSupabaseAdmin();

    // Get invitations created by this user, sorted by newest first
    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("created_by", user.email)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Database error:", error);
      return Response.json(
        { error: "Failed to fetch invitations" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      invitations: invitations || [],
    });

  } catch (err) {
    console.error("Get invitations error:", err);
    return Response.json(
      { error: "Failed to get invitations" },
      { status: 500 }
    );
  }
}
