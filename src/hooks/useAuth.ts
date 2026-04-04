/**
 * Unified auth hook for client-side usage
 * Works for both ADMIN (email) and VISITOR (google) users
 * Replaces scattered getCurrentUser() calls and localStorage checks
 */

"use client";

import { useSession } from "next-auth/react";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  userType: "ADMIN" | "VISITOR";
  role: string | null;
  permissions: string[];
  isMaster: boolean;
  name?: string | null;
  image?: string | null;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVisitor: boolean;
  isMaster: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

/**
 * useAuth hook - Unified auth access for all components
 *
 * Usage:
 *   const { user, isAuthenticated, isAdmin } = useAuth();
 *
 *   if (!isAuthenticated) return <LoginRequired />;
 *
 *   if (!user?.permissions.includes("canUploadPhotos")) {
 *     return <NoPermission />;
 *   }
 *
 *  Works for:
 *   - Admin users (email magic link sign-in)
 *   - Visitor users (Google OAuth sign-in)
 */
export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession();
  const user = session?.user as AuthUser | undefined;

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!user;
  const isAdmin = user?.userType === "ADMIN" || false;
  const isVisitor = user?.userType === "VISITOR" || false;
  const isMaster = user?.isMaster || false;

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    // HEAD and CO_HEAD have all permissions
    if (user.role === "head" || user.role === "co_head") {
      return true;
    }

    // Check explicit permission array
    return user.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role || false;
  };

  return {
    user: user || null,
    isLoading,
    isAuthenticated,
    isAdmin,
    isVisitor,
    isMaster,
    hasPermission,
    hasRole,
  };
}

/**
 * Hook to check if user has admin access
 * Returns true if user is HEAD or CO_HEAD
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "head" || user?.role === "co_head" || false;
}

/**
 * Hook to check if user has specific permission
 * Auto-returns true for HEAD/CO_HEAD
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

/**
 * Hook to check if user is the master account
 */
export function useIsMaster(): boolean {
  const { isMaster } = useAuth();
  return isMaster;
}
