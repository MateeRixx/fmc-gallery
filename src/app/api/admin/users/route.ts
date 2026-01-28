/**
 * API Route: GET /api/admin/users
 * 
 * Get all users in the system
 * Only Head and Co-Head can access this
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireSupremeAdmin } from "@/lib/middleware";
import { User } from "@/types";

export async function GET(request: NextRequest) {
  // Require Head or Co-Head
  const user = await requireSupremeAdmin(request);
  if (user instanceof Response) return user;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

    const users: User[] = data || [];

    return Response.json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
