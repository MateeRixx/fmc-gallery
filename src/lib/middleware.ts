/**
 * API Route Middleware Functions
 * 
 * Use these middleware functions in your API routes to protect endpoints
 * and enforce role-based access control.
 * 
 * Example usage:
 * 
 * export async function POST(request: Request) {
 *   // Require authentication
 *   const user = await requireAuth(request);
 *   if (user instanceof Response) return user;
 * 
 *   // Require Head or Co-Head role
 *   if (!isSupremeAdmin(user.role)) {
 *     return Response.json({ error: "Unauthorized" }, { status: 403 });
 *   }
 * 
 *   // Your route logic here
 *   return Response.json({ success: true });
 * }
 */

import { NextRequest } from "next/server";
import { JWTPayload, UserRole, Permission } from "@/types";
import { extractTokenFromHeader, verifyJWT } from "./jwt";
import { hasPermission } from "./rbac";

/**
 * Middleware: Require authentication
 * 
 * Usage:
 * const user = await requireAuth(request);
 * if (user instanceof Response) return user; // Error response
 */
export async function requireAuth(request: Request | NextRequest): Promise<JWTPayload | Response> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return Response.json(
      { error: "Missing authentication token" },
      { status: 401 }
    );
  }

  const payload = verifyJWT(token);
  if (!payload) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  return payload;
}

/**
 * Middleware: Require specific role
 * 
 * Usage:
 * const user = await requireRole(request, UserRole.HEAD);
 * if (user instanceof Response) return user; // Error response
 */
export async function requireRole(
  request: Request | NextRequest,
  requiredRole: UserRole
): Promise<JWTPayload | Response> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== requiredRole) {
    return Response.json(
      { error: `Only ${requiredRole} users can access this` },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Middleware: Require supreme admin (Head or Co-Head)
 * 
 * Usage:
 * const user = await requireSupremeAdmin(request);
 * if (user instanceof Response) return user; // Error response
 */
export async function requireSupremeAdmin(
  request: Request | NextRequest
): Promise<JWTPayload | Response> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== UserRole.HEAD && authResult.role !== UserRole.CO_HEAD) {
    return Response.json(
      { error: "Only Head or Co-Head can access this" },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Middleware: Require specific permission
 * Works for Executives and automatically grants to Head/Co-Head
 * 
 * Usage:
 * const user = await requirePermission(request, Permission.CAN_ADD_EVENTS);
 * if (user instanceof Response) return user; // Error response
 */
export async function requirePermission(
  request: Request | NextRequest,
  permission: Permission
): Promise<JWTPayload | Response> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  if (!hasPermission(authResult, permission)) {
    return Response.json(
      { error: `You don't have permission to ${permission}` },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Middleware: Require admin access (Head, Co-Head, or Executive with CAN_ACCESS_ADMIN_PANEL)
 * 
 * Usage:
 * const user = await requireAdminAccess(request);
 * if (user instanceof Response) return user; // Error response
 */
export async function requireAdminAccess(
  request: Request | NextRequest
): Promise<JWTPayload | Response> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const isAdmin =
    authResult.role === UserRole.HEAD ||
    authResult.role === UserRole.CO_HEAD ||
    (authResult.role === UserRole.EXECUTIVE && hasPermission(authResult, "canAccessAdminPanel" as Permission));

  if (!isAdmin) {
    return Response.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Middleware: Check if request has valid API token
 * For backward compatibility with existing API token system
 * 
 * Usage:
 * const error = await requireApiToken(request);
 * if (error) return error; // Error response
 */
export async function requireApiToken(request: Request | NextRequest): Promise<Response | null> {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "Service misconfigured: ADMIN_API_TOKEN missing" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim();

  if (!token || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
