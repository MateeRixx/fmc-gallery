/**
 * RBAC Utility Functions
 * 
 * This module provides helper functions for role-based access control.
 * Use these to check permissions throughout the app.
 */

import { UserRole, Permission, JWTPayload } from "@/types";

/**
 * Check if a user role is a supreme admin (Head or Co-Head)
 */
export function isSupremeAdmin(role: UserRole): boolean {
  return role === UserRole.HEAD || role === UserRole.CO_HEAD;
}

/**
 * Check if a user has a specific permission
 * - Head/Co-Head have all permissions
 * - Executives need explicit permission
 * - Members/Inactive have no permissions
 */
export function hasPermission(user: JWTPayload, permission: Permission): boolean {
  // Supreme admins have all permissions
  if (isSupremeAdmin(user.role)) {
    return true;
  }

  // Inactive users have no permissions
  if (user.role === UserRole.INACTIVE) {
    return false;
  }

  // Members have read-only (no edit/delete permissions)
  if (user.role === UserRole.MEMBER) {
    return false;
  }

  // Executives need explicit permission
  if (user.role === UserRole.EXECUTIVE) {
    return user.permissions.includes(permission);
  }

  return false;
}

/**
 * Check if user can perform an action
 * Combines role and permission checks
 */
export function canPerformAction(user: JWTPayload, requiredRole?: UserRole, requiredPermission?: Permission): boolean {
  // If a specific role is required, check it first
  if (requiredRole) {
    if (requiredRole === UserRole.HEAD) {
      return user.role === UserRole.HEAD;
    }
    if (requiredRole === UserRole.CO_HEAD) {
      return user.role === UserRole.CO_HEAD;
    }
  }

  // If a permission is required, check it
  if (requiredPermission) {
    return hasPermission(user, requiredPermission);
  }

  return true;
}

/**
 * Default permissions for each role when assigned
 * Executives get custom permissions, this is just the starting set
 */
export function getDefaultPermissionsForRole(role: UserRole): Permission[] {
  switch (role) {
    case UserRole.HEAD:
    case UserRole.CO_HEAD:
      // They have all permissions implicitly, return empty
      return [];
    
    case UserRole.EXECUTIVE:
      // Default permissions for new executives (can be customized)
      return [
        Permission.CAN_ADD_EVENTS,
        Permission.CAN_UPLOAD_PHOTOS,
      ];
    
    case UserRole.MEMBER:
      // Read-only
      return [];
    
    case UserRole.INACTIVE:
      // No permissions
      return [];
    
    default:
      return [];
  }
}

/**
 * Get all permissions that could be assigned to an Executive
 */
export function getExecutivePermissions(): Permission[] {
  return Object.values(Permission);
}

/**
 * Format role name for display
 */
export function formatRole(role: UserRole): string {
  const roleMap: Record<UserRole, string> = {
    [UserRole.HEAD]: "Head",
    [UserRole.CO_HEAD]: "Co-Head",
    [UserRole.EXECUTIVE]: "Executive",
    [UserRole.MEMBER]: "Member",
    [UserRole.INACTIVE]: "Inactive",
  };
  return roleMap[role] || role;
}

/**
 * Format permission name for display
 */
export function formatPermission(permission: Permission): string {
  const permissionMap: Record<Permission, string> = {
    [Permission.CAN_ADD_EVENTS]: "Add Events",
    [Permission.CAN_EDIT_EVENTS]: "Edit Events",
    [Permission.CAN_DELETE_EVENTS]: "Delete Events",
    [Permission.CAN_UPLOAD_PHOTOS]: "Upload Photos",
    [Permission.CAN_DELETE_PHOTOS]: "Delete Photos",
    [Permission.CAN_MANAGE_MEMBERS]: "Manage Members",
    [Permission.CAN_GRANT_PERMISSIONS]: "Grant Permissions",
    [Permission.CAN_VIEW_ANALYTICS]: "View Analytics",
    [Permission.CAN_ACCESS_ADMIN_PANEL]: "Access Admin Panel",
  };
  return permissionMap[permission] || permission;
}
