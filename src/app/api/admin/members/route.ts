/**
 * API Route: GET /api/admin/members
 *
 * List all members and their roles
 * Paginated with 50 per page
 * Accessible to ADMIN+ (CO_HEAD and HEAD)
 */

import { requireAdmin } from "@/lib/auth-utils";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    // Ensure user is admin
    const user = await requireAdmin();

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = 50;
    const offset = (page - 1) * pageSize;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get total count
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    // Get paginated members with membership info
    const { data: members, error } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        full_name,
        created_at,
        memberships:memberships(
          id,
          role_level,
          is_active,
          start_date,
          end_date
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Error fetching members:", error);
      return Response.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    // Transform response: flatten membership data
    const transformedMembers = members.map((member: any) => {
      const membership = Array.isArray(member.memberships) 
        ? member.memberships[0] 
        : member.memberships;
      return {
        id: member.id,
        email: member.email,
        full_name: member.full_name,
        created_at: member.created_at,
        role_level: membership?.role_level ?? 0,
        is_active: membership?.is_active ?? false,
        start_date: membership?.start_date || member.created_at,
        end_date: membership?.end_date,
      };
    });

    return Response.json(
      {
        success: true,
        members: transformedMembers,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in GET /api/admin/members:", error);
    return Response.json(
      { error: error.message || "Failed to fetch members" },
      { status: error.statusCode || 500 }
    );
  }
}
