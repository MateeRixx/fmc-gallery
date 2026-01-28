// src/types/index.ts

/**
 * ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM
 * 
 * This file defines all roles, permissions, and types for the FMC Gallery Admin system.
 * 
 * ROLES:
 * - Head: Only 1 at a time. Full supreme admin rights. Can do everything including changing roles.
 * - Co-Head: Only 1 at a time. Same full supreme admin rights as Head.
 * - Executive: Multiple people. Limited permissions. Can view everything but can only add events,
 *   upload photos, edit/delete their own content UNLESS granted extra permissions.
 * - Member: Normal user. Read-only access.
 * - Inactive: For people who left the club. All access revoked instantly.
 */

// ===== ENUMS =====

export enum UserRole {
  HEAD = "head",
  CO_HEAD = "co_head",
  EXECUTIVE = "executive",
  MEMBER = "member",
  INACTIVE = "inactive",
}

/**
 * Granular permissions for Executives.
 * Head and Co-Head have all permissions by default.
 * Members have read-only access.
 * Inactive users have no permissions.
 */
export enum Permission {
  // Event management
  CAN_ADD_EVENTS = "canAddEvents",
  CAN_EDIT_EVENTS = "canEditEvents",
  CAN_DELETE_EVENTS = "canDeleteEvents",

  // Photo management
  CAN_UPLOAD_PHOTOS = "canUploadPhotos",
  CAN_DELETE_PHOTOS = "canDeletePhotos",

  // User management
  CAN_MANAGE_MEMBERS = "canManageMembers", // Can invite/remove members
  CAN_GRANT_PERMISSIONS = "canGrantPermissions", // Can grant/revoke permissions to other Executives

  // Admin access
  CAN_VIEW_ANALYTICS = "canViewAnalytics",
  CAN_ACCESS_ADMIN_PANEL = "canAccessAdminPanel",
}

// ===== INTERFACES =====

export interface Event {
  id: number;
  slug: string;
  title: string;
  description: string;
  cover_url: string;
  hero_image_url?: string | null;
  starts_at?: string;
}

/**
 * User record from Supabase
 * This is what's stored in the "users" table
 */
export interface User {
  id: string; // UUID from Supabase auth
  email: string;
  role: UserRole;
  permissions: Permission[]; // Only used for Executives; Head/Co-Head have all
  full_name?: string;
  avatar_url?: string;
  created_by?: string; // ID of the user who added this person
  created_at?: string;
  updated_at?: string;
  // For yearly handover
  role_updated_at?: string;
  role_updated_by?: string; // ID of who changed the role
}

/**
 * JWT Payload - what goes into the auth token
 * This includes role and permissions for quick authorization checks
 */
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat: number; // issued at
  exp: number; // expiration
}

/**
 * Request with decoded user info (for middleware)
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Response for role change operations
 */
export interface RoleChangeResponse {
  success: boolean;
  message: string;
  user?: User;
  previousRole?: UserRole;
  newRole?: UserRole;
}

/**
 * Response for permission grant/revoke
 */
export interface PermissionChangeResponse {
  success: boolean;
  message: string;
  user?: User;
  permissions?: Permission[];
}

