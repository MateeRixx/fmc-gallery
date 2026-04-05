/**
 * Server-side authentication utilities
 * Use these functions in API routes to protect endpoints
 * Now integrated with membership-based roles
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { getUserRoleLevel, ROLE_LEVELS } from "./membership-utils";

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Get authenticated user session
 * @throws UnauthorizedError if not authenticated
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new UnauthorizedError("Not authenticated");
  }
  return session.user;
}

/**
 * Check if user has a specific role level (0-3)
 * @throws ForbiddenError if role level is insufficient
 */
export async function requireRoleLevel(requiredLevel: number) {
  const user = await requireAuth();
  const userLevel = await getUserRoleLevel(user.id);

  if (userLevel < requiredLevel) {
    throw new ForbiddenError(`Role level ${requiredLevel} required`);
  }

  return user;
}

/**
 * Check if user is EXECUTIVE or above (level 1+)
 * @throws ForbiddenError if not executive+
 */
export async function requireExecutive() {
  return requireRoleLevel(ROLE_LEVELS.EXECUTIVE);
}

/**
 * Check if user is CO_HEAD (level 2)
 * @throws ForbiddenError if not co-head+
 */
export async function requireCoHead() {
  return requireRoleLevel(ROLE_LEVELS.CO_HEAD);
}

/**
 * Check if user is HEAD (level 3)
 * @throws ForbiddenError if not head
 */
export async function requireHead() {
  return requireRoleLevel(ROLE_LEVELS.HEAD);
}

/**
 * Check if user is admin (CO_HEAD or HEAD)
 * @throws ForbiddenError if not admin
 */
export async function requireAdmin() {
  const user = await requireAuth();
  const userLevel = await getUserRoleLevel(user.id);

  if (userLevel < ROLE_LEVELS.CO_HEAD) {
    throw new ForbiddenError("Admin access required");
  }

  return user;
}

/**
 * Check if user is master account
 * @throws ForbiddenError if not master
 */
export async function requireMaster() {
  const user = await requireAuth();

  if (!user.isMaster) {
    throw new ForbiddenError("Master account required");
  }

  return user;
}

/**
 * Try to get current session without throwing
 * Returns null if not authenticated
 */
export async function getAuthSession() {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

/**
 * Check permission without throwing
 * Returns boolean instead of throwing
 */
export function hasPermission(user: any, permission: string): boolean {
  const level = user?.roleLevel ?? 0;

  // CO_HEAD and HEAD have all view permissions
  if (level >= ROLE_LEVELS.CO_HEAD) {
    return true;
  }

  // Check explicit permissions
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

/**
 * Check if user is authenticated without throwing
 */
export function isAuthenticated(user: any): boolean {
  return !!user?.id && !!user?.email;
}

/**
 * Standardized error response for API routes
 */
export function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return {
      status: error.statusCode,
      body: { error: error.message },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: { error: error.message },
    };
  }

  return {
    status: 500,
    body: { error: "Internal Server Error" },
  };
}

/**
 * Wrap API route handler with automatic error handling
 * Usage: export const GET = withAuth(async (req, user) => { ... })
 */
export function withAuth(
  handler: (
    req: Request,
    user: any
  ) => Promise<Response> | Response
) {
  return async (req: Request) => {
    try {
      const user = await requireAuth();
      return await handler(req, user);
    } catch (error) {
      const { status, body } = errorResponse(error);
      return new Response(JSON.stringify(body), { status });
    }
  };
}

/**
 * Wrap API route handler with role level check
 * Usage: export const GET = withAuthRoleLevel(1)(async (req, user) => { ... })
 */
export function withAuthRoleLevel(requiredLevel: number) {
  return (
    handler: (
      req: Request,
      user: any
    ) => Promise<Response> | Response
  ) => {
    return async (req: Request) => {
      try {
        const user = await requireRoleLevel(requiredLevel);
        return await handler(req, user);
      } catch (error) {
        const { status, body } = errorResponse(error);
        return new Response(JSON.stringify(body), { status });
      }
    };
  };
}

/**
 * Wrap API route handler with executive+ check
 * Usage: export const POST = withAuthExecutive()(async (req, user) => { ... })
 */
export function withAuthExecutive() {
  return withAuthRoleLevel(ROLE_LEVELS.EXECUTIVE);
}

/**
 * Wrap API route handler with co-head+ check
 * Usage: export const POST = withAuthCoHead()(async (req, user) => { ... })
 */
export function withAuthCoHead() {
  return withAuthRoleLevel(ROLE_LEVELS.CO_HEAD);
}

/**
 * Wrap API route handler with head-only check
 * Usage: export const POST = withAuthHead()(async (req, user) => { ... })
 */
export function withAuthHead() {
  return withAuthRoleLevel(ROLE_LEVELS.HEAD);
}

/**
 * Wrap API route handler with permission check
 * Usage: export const POST = withAuthPermission("canUploadPhotos")(async (req, user) => { ... })
 */
export function withAuthPermission(permission: string) {
  return (
    handler: (
      req: Request,
      user: any
    ) => Promise<Response> | Response
  ) => {
    return async (req: Request) => {
      try {
        const user = await requireAuth();
        if (!hasPermission(user, permission)) {
          throw new ForbiddenError(`Permission ${permission} required`);
        }
        return await handler(req, user);
      } catch (error) {
        const { status, body } = errorResponse(error);
        return new Response(JSON.stringify(body), { status });
      }
    };
  };
}

/**
 * Compatibility wrappers for old middleware API
 */

export async function requireAuthCompat(request: Request): Promise<any | Response> {
  try {
    return await requireAuth();
  } catch (error) {
    const { status, body } = errorResponse(error);
    return Response.json(body, { status });
  }
}

export async function requirePermissionCompat(
  request: Request,
  permission: string
): Promise<any | Response> {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, permission)) {
      throw new ForbiddenError(`Permission ${permission} required`);
    }
    return user;
  } catch (error) {
    const { status, body } = errorResponse(error);
    return Response.json(body, { status });
  }
}

export async function requireRoleCompat(
  request: Request,
  role: string
): Promise<any | Response> {
  try {
    return await requireAuth();
  } catch (error) {
    const { status, body } = errorResponse(error);
    return Response.json(body, { status });
  }
}

export async function requireAdminCompat(request: Request): Promise<any | Response> {
  try {
    return await requireAdmin();
  } catch (error) {
    const { status, body } = errorResponse(error);
    return Response.json(body, { status });
  }
}

export async function requireSupremeAdminCompat(request: Request): Promise<any | Response> {
  try {
    return await requireHead();
  } catch (error) {
    const { status, body } = errorResponse(error);
    return Response.json(body, { status });
  }
}

export async function requireExecutiveCompat(request: Request): Promise<any | Response> {
  try {
    return await requireExecutive();
  } catch (error) {
    const { status, body } = errorResponse(error);
    return Response.json(body, { status });
  }
}

// Backwards compatibility alias
export const requireSupremeAdmin = requireSupremeAdminCompat;
