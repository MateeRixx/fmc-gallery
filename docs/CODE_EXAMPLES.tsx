/**
 * RBAC Code Examples - Copy & Paste Ready
 * 
 * Common patterns you'll use when implementing RBAC
 * All examples are production-ready
 */

// ============================================================================
// EXAMPLE 1: Frontend - Check if user can see admin button
// ============================================================================

import { getCurrentUser, clearToken, isTokenExpiringSoon } from "@/lib/jwt";
import { isSupremeAdmin, hasPermission, formatRole } from "@/lib/rbac";
import { Permission, UserRole } from "@/types";
import { requireAuth, requireSupremeAdmin, requirePermission } from "@/lib/middleware";
import { useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

export function AdminButton() {
  const user = getCurrentUser();

  if (!user || !isSupremeAdmin(user.role)) {
    return null; // Don't render button
  }

  return (
    <button onClick={() => window.location.href = "/admin"}>
      Admin Panel
    </button>
  );
}

// ============================================================================
// EXAMPLE 2: Frontend - Show permission-based UI
// ============================================================================

export function AddEventForm() {
  const user = getCurrentUser();

  if (!user || !hasPermission(user, Permission.CAN_ADD_EVENTS)) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded">
        You don't have permission to add events.
        Contact your Head or Co-Head.
      </div>
    );
  }

  return (
    <form>
      {/* Event form fields */}
    </form>
  );
}

// ============================================================================
// EXAMPLE 3: Frontend - Logout user
// ============================================================================

export function LogoutButton() {
  const handleLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}

// ============================================================================
// EXAMPLE 4: Frontend - Display user info
// ============================================================================

export function UserProfile() {
  const user = getCurrentUser();

  if (!user) {
    return <div>Not logged in</div>;
  }

  return (
    <div>
      <p>Email: {user.email}</p>
      <p>Role: {formatRole(user.role)}</p>
      <p>Expires: {new Date(user.exp * 1000).toLocaleDateString()}</p>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Backend - Protect admin-only route
// ============================================================================

import { NextRequest } from "next/server";

export async function POST_AdminOnly(request: NextRequest) {
  // Check if user is Head or Co-Head
  const user = await requireSupremeAdmin(request);
  if (user instanceof Response) return user;

  // User is verified as Head/Co-Head
  console.log(`Admin action by: ${user.email}`);

  return Response.json({ success: true });
}

// ============================================================================
// EXAMPLE 6: Backend - Protect permission-based route
// ============================================================================

export async function POST_CreateEvent(request: NextRequest) {
  // Check if user has canAddEvents permission
  // (automatically includes Head/Co-Head)
  const user = await requirePermission(request, Permission.CAN_ADD_EVENTS);
  if (user instanceof Response) return user;

  // User has permission
  console.log(`Event created by: ${user.email}`);

  return Response.json({ success: true });
}

// ============================================================================
// EXAMPLE 7: Backend - Protect route with auth only
// ============================================================================

export async function GET(request: Request) {
  // Check if user is authenticated (any role)
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  // User is authenticated
  // Access user.role, user.email, user.permissions

  return Response.json({ 
    success: true, 
    userRole: user.role 
  });
}

// ============================================================================
// EXAMPLE 8: Backend - Custom permission check
// ============================================================================

export async function POST_ManageMembers(request: Request) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  // Custom logic: only allow if:
  // 1. User is Head/Co-Head, OR
  // 2. User is Executive with canManageMembers permission
  const canManage = 
    user.role === "head" || 
    user.role === "co_head" || 
    hasPermission(user, Permission.CAN_MANAGE_MEMBERS);

  if (!canManage) {
    return Response.json(
      { error: "You cannot manage members" },
      { status: 403 }
    );
  }

  // User can manage members
  return Response.json({ success: true });
}

// ============================================================================
// EXAMPLE 9: Frontend - API call with auth header
// ============================================================================

async function createEvent(eventData: Record<string, unknown>) {
  const token = localStorage.getItem("fmc-auth-token");

  if (!token) {
    // User not logged in
    window.location.href = "/login";
    return;
  }

  const response = await fetch("/api/admin/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(eventData),
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem("fmc-auth-token");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    const errorData = await response.json();
throw new Error(errorData.error || 'Request failed');
  }

  return await response.json();
}

// ============================================================================
// EXAMPLE 10: Frontend - Protected form submission
// ============================================================================

export function AddPhotoForm() {
  const user = getCurrentUser();
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check permission before submit
    if (!user || !hasPermission(user, Permission.CAN_UPLOAD_PHOTOS)) {
      alert("You don't have permission to upload photos");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData);
      const result = await createEvent(data);
      alert("Photo uploaded successfully");
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={uploading}>
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}

// ============================================================================
// EXAMPLE 11: Backend - Track who made changes
// ============================================================================

export async function POST_CreateEventTracked(request: Request) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("events")
    .insert({
      title: "New Event",
      created_by: user.sub, // Track who created it
    })
    .select()
    .single();

  if (error) return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });

  return Response.json({ success: true, event: data });
}

// ============================================================================
// EXAMPLE 12: Component - User roles dropdown
// ============================================================================

export function RoleSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="border rounded px-3 py-2"
    >
      {Object.values(UserRole).map((role) => (
        <option key={role} value={role}>
          {formatRole(role)}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// EXAMPLE 13: Utility - Check if user is expiring soon
// ============================================================================

export function TokenExpiryWarning() {
  const user = getCurrentUser();

  if (!user || !isTokenExpiringSoon(user, 1)) {
    return null; // Token is fine
  }

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
      Your session expires soon. Please refresh or login again.
      <a href="/login" className="ml-2 text-blue-600 underline">
        Login again
      </a>
    </div>
  );
}

// ============================================================================
// EXAMPLE 14: Backend - Change user role (admin action)
// ============================================================================

async function changeUserRole(userId: string, newRole: string) {
  const token = localStorage.getItem("fmc-auth-token");

  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ newRole }),
  });

  if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.message || errorData.error || 'Request failed');
}

  return await response.json();
}

// ============================================================================
// EXAMPLE 15: Backend - Grant permission (admin action)
// ============================================================================

async function grantPermission(userId: string, permission: string) {
  const token = localStorage.getItem("fmc-auth-token");

  const response = await fetch(`/api/admin/users/${userId}/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      permissions: [permission],
      action: "grant",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }

  return await response.json();
}

// ============================================================================
// EXAMPLE 16: Backend - Deactivate user
// ============================================================================

async function deactivateUser(userId: string) {
  const token = localStorage.getItem("fmc-auth-token");

  const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }

  return await response.json();
}

// ============================================================================
// EXAMPLE 17: Component - Conditional rendering by role
// ============================================================================

function HeadOnlyComponent() {
  return <div>Head-only content</div>;
}

function CoHeadOnlyComponent() {
  return <div>Co-Head-only content</div>;
}

function ExecutiveOnlyComponent() {
  return <div>Executive-only content</div>;
}

function MemberOnlyComponent() {
  return <div>Member-only content</div>;
}

function InactiveMessage() {
  return <div>Your account is inactive</div>;
}

export function RoleBasedContent() {
  const user = getCurrentUser();

  return (
    <>
      {user?.role === UserRole.HEAD && <HeadOnlyComponent />}
      {user?.role === UserRole.CO_HEAD && <CoHeadOnlyComponent />}
      {user?.role === UserRole.EXECUTIVE && <ExecutiveOnlyComponent />}
      {user?.role === UserRole.MEMBER && <MemberOnlyComponent />}
      {user?.role === UserRole.INACTIVE && <InactiveMessage />}
    </>
  );
}

// ============================================================================
// EXAMPLE 18: Middleware - Role-based API response
// ============================================================================

export async function GET_RoleBasedResponse(request: Request) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  // Return different data based on role
  const response: Record<string, unknown> = {
    user: {
      email: user.email,
      role: user.role,
    },
  };

  if (user.role === "head" || user.role === "co_head") {
    // Include sensitive data for admins only
    response["adminData"] = {
      allUsers: [],
      statistics: {},
    };
  }

  return Response.json(response);
}

// ============================================================================
// EXAMPLE 19: Error handling in frontend
// ============================================================================

async function handleAdminAction(action: () => Promise<unknown>) {
  try {
    const result = await action();
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === "Unauthorized") {
      // Token expired
      window.location.href = "/login";
    } else if (errorMessage === "Forbidden") {
      // No permission
      alert("You don't have permission for this action");
    } else {
      // Other error
      alert(`Error: ${errorMessage}`);
    }
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// EXAMPLE 20: Database query - Find users with permission
// ============================================================================

/**
 * In your Supabase SQL:
 * 
 * SELECT * FROM users 
 * WHERE 'canManageMembers' = ANY(permissions)
 * AND role != 'inactive';
 * 
 * Or in JavaScript with Supabase SDK:
 */

async function findUsersWithPermission(permission: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .contains("permissions", [permission])
    .neq("role", "inactive");

  return data || [];
}

// ============================================================================
// Copy-paste tips:
// 1. Replace EXAMPLE N with your use case
// 2. Update imports to match your file structure
// 3. Add error handling for your specific needs
// 4. Test with different user roles
// 5. Review types and enums before copying
// ============================================================================
