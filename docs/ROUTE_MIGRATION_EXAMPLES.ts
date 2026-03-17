/**
 * EXAMPLE: Protecting Existing API Routes with RBAC
 * 
 * This file shows how to update your existing API routes to use the new
 * role-based access control system with proper authentication.
 * 
 * Replace the old API token check with the new middleware functions.
 */

// ============================================================================
// EXAMPLE 1: /api/admin/events route (protected)
// ============================================================================

/**
 * BEFORE: Using old API token system
 * 
 * function authorize(request: Request): Response | null {
 *   const expected = process.env.ADMIN_API_TOKEN;
 *   if (!expected) {
 *     return Response.json({ error: "Service misconfigured" }, { status: 500 });
 *   }
 *   const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
 *   if (!token || token !== expected) {
 *     return Response.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 *   return null;
 * }
 */

/**
 * AFTER: Using new RBAC system
 */

import { requirePermission, requireSupremeAdmin } from "@/lib/middleware";
import { Permission } from "@/types";
import { createClient } from "@supabase/supabase-js";

// GET /api/admin/events
// Get list of events (requires Head/Co-Head or canAccessAdminPanel)
export async function GET(request: Request) {
  // Only allow supreme admins
  const user = await requireSupremeAdmin(request);
  if (user instanceof Response) return user;

  // Your route logic here
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Service misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug")
    .order("id", { ascending: true });

  if (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  return Response.json({ success: true, data: data || [] });
}

// POST /api/admin/events
// Create event (requires canAddEvents permission)
export async function POST(request: Request) {
  // Allow only those with permission to add events
  // (automatically includes Head/Co-Head)
  const user = await requirePermission(request, Permission.CAN_ADD_EVENTS);
  if (user instanceof Response) return user;

  try {
    const body = await request.json();

    // Track who created this event
    const createdBy = user.sub;

    // Your event creation logic here
    // Use user.role and user.permissions for access control

    return Response.json({ success: true, message: "Event created" });
  } catch (err) {
    return Response.json({ error: "Failed to create event" }, { status: 500 });
  }
}

// ============================================================================
// EXAMPLE 2: /api/admin/photos route (protected)
// ============================================================================

/**
 * POST /api/admin/photos
 * Upload photos to an event
 * Requires: canUploadPhotos permission (includes Head/Co-Head)
 * 
 * Also checks: user can only upload to events they created
 * (optional - depends on your business logic)
 */

export async function POST_PHOTOS(request: Request) {
  // Require canUploadPhotos permission
  const user = await requirePermission(request, Permission.CAN_UPLOAD_PHOTOS);
  if (user instanceof Response) return user;

  try {
    const body = await request.json();
    const { event_id, urls } = body;

    if (!event_id || !urls) {
      return Response.json({ error: "Missing event_id or urls" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional: Check if user can edit this event
    // (only if they created it, unless they're Head/Co-Head)
    const { data: event } = await supabase
      .from("events")
      .select("created_by")
      .eq("id", event_id)
      .single();

    if (
      event &&
      event.created_by !== user.sub &&
      user.role !== "head" &&
      user.role !== "co_head"
    ) {
      return Response.json(
        { error: "You can only upload photos to events you created" },
        { status: 403 }
      );
    }

    // Insert photos
    const rows = urls.map((url: string) => ({
      event_id,
      path: url.trim(),
    }));

    const { error } = await supabase.from("photos").insert(rows);

    if (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

    return Response.json({ ok: true, count: rows.length });
  } catch (err) {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ============================================================================
// EXAMPLE 3: Public API route (no authentication needed)
// ============================================================================

/**
 * GET /api/public/events
 * Public endpoint to list all events
 * No authentication required
 */

export async function GET_PUBLIC(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("events")
      .select("*")
      .neq("published", false) // Only published events
      .order("starts_at", { ascending: false });

    return Response.json({ success: true, data: data || [] });
  } catch (err) {
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// ============================================================================
// EXAMPLE 4: Middleware for frontend data fetching
// ============================================================================

/**
 * Use the JWT token in frontend API calls:
 * 
 * const token = localStorage.getItem("fmc-auth-token");
 * const response = await fetch("/api/admin/events", {
 *   headers: {
 *     "Authorization": `Bearer ${token}`,
 *   },
 * });
 */

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/**
 * To migrate existing routes to RBAC:
 * 
 * 1. Replace authorize(request) call with:
 *    const user = await requireAuth(request);
 *    if (user instanceof Response) return user;
 * 
 * 2. For admin-only routes, use:
 *    const user = await requireSupremeAdmin(request);
 *    if (user instanceof Response) return user;
 * 
 * 3. For permission-based routes, use:
 *    const user = await requirePermission(request, Permission.CAN_ADD_EVENTS);
 *    if (user instanceof Response) return user;
 * 
 * 4. Update frontend fetch calls to include Authorization header:
 *    fetch(url, {
 *      headers: {
 *        "Authorization": `Bearer ${localStorage.getItem("fmc-auth-token")}`
 *      }
 *    })
 * 
 * 5. Test with different user roles:
 *    - Login as Head/Co-Head (should have all access)
 *    - Login as Executive (should have limited access)
 *    - Login as Member (should have read-only access)
 *    - Try inactive user (should get login error)
 * 
 * 6. Remove old authorization functions
 * 
 * 7. Remove old API_TOKEN from environment variables (optional, for backward compatibility)
 */
