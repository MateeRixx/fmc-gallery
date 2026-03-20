/**
 * Role Default Permissions
 * Defines what permissions are automatically assigned to each role
 */

import { UserRole, Permission } from "@/types";

/**
 * Default permissions for each role
 * These are automatically assigned when a user is created with that role
 */
export const roleDefaultPermissions: Record<UserRole, Permission[]> = {
  [UserRole.HEAD]: [
    Permission.CAN_ADD_EVENTS,
    Permission.CAN_EDIT_EVENTS,
    Permission.CAN_DELETE_EVENTS,
    Permission.CAN_UPLOAD_PHOTOS,
    Permission.CAN_DELETE_PHOTOS,
    Permission.CAN_MANAGE_MEMBERS,
    Permission.CAN_GRANT_PERMISSIONS,
    Permission.CAN_VIEW_ANALYTICS,
    Permission.CAN_ACCESS_ADMIN_PANEL,
  ],
  [UserRole.CO_HEAD]: [
    Permission.CAN_ADD_EVENTS,
    Permission.CAN_EDIT_EVENTS,
    Permission.CAN_DELETE_EVENTS,
    Permission.CAN_UPLOAD_PHOTOS,
    Permission.CAN_DELETE_PHOTOS,
    Permission.CAN_MANAGE_MEMBERS,
    Permission.CAN_GRANT_PERMISSIONS,
    Permission.CAN_VIEW_ANALYTICS,
    Permission.CAN_ACCESS_ADMIN_PANEL,
  ],
  [UserRole.EXECUTIVE]: [
    Permission.CAN_ADD_EVENTS,
    Permission.CAN_EDIT_EVENTS,
    Permission.CAN_UPLOAD_PHOTOS,
    Permission.CAN_VIEW_ANALYTICS,
    Permission.CAN_ACCESS_ADMIN_PANEL,
  ],
  [UserRole.MEMBER]: [],
  [UserRole.INACTIVE]: [],
};

/**
 * Get permissions for a specific role
 */
export function getDefaultPermissionsForRole(role: UserRole): Permission[] {
  return roleDefaultPermissions[role] || [];
}

/**
 * Role hierarchy for invitation control
 * Shows what roles each role can invite
 */
export const roleInviteHierarchy: Record<UserRole, UserRole[]> = {
  [UserRole.HEAD]: [UserRole.HEAD, UserRole.CO_HEAD, UserRole.EXECUTIVE, UserRole.MEMBER],
  [UserRole.CO_HEAD]: [UserRole.EXECUTIVE, UserRole.MEMBER],
  [UserRole.EXECUTIVE]: [],
  [UserRole.MEMBER]: [],
  [UserRole.INACTIVE]: [],
};

/**
 * Check if a role can invite another role
 */
export function canInviteRole(inviterRole: UserRole, targetRole: UserRole): boolean {
  return roleInviteHierarchy[inviterRole]?.includes(targetRole) || false;
}

/**
 * Role display names
 */
export const roleDisplayNames: Record<UserRole, string> = {
  [UserRole.HEAD]: "Head",
  [UserRole.CO_HEAD]: "Co-Head",
  [UserRole.EXECUTIVE]: "Executive",
  [UserRole.MEMBER]: "Member",
  [UserRole.INACTIVE]: "Inactive",
};

/**
 * Role descriptions
 */
export const roleDescriptions: Record<UserRole, string> = {
  [UserRole.HEAD]: "Full admin access. Leads the organization and manages all operations.",
  [UserRole.CO_HEAD]: "Full admin access. Assists the Head in managing operations.",
  [UserRole.EXECUTIVE]: "Can add/edit events and upload photos. Limited admin access.",
  [UserRole.MEMBER]: "Read-only access to galleries. No admin permissions.",
  [UserRole.INACTIVE]: "No access. Account is deactivated.",
};
