/**
 * Component: UserManagementPanel
 * 
 * Admin dashboard component for managing users, roles, and permissions.
 * Only visible to Head and Co-Head.
 * 
 * Features:
 * - View all users with their roles
 * - Change user roles (with automatic demotion of existing Head/Co-Head)
 * - Grant/revoke permissions for Executives
 * - Deactivate users
 * - View role change history
 */

"use client";

import { useState, useEffect } from "react";
import { User, UserRole, Permission } from "@/types";
import { formatRole, formatPermission, getExecutivePermissions } from "@/lib/rbac";

interface UserManagementPanelProps {
  onRefresh?: () => void;
}

export default function UserManagementPanel({ onRefresh }: UserManagementPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [action, setAction] = useState<"role" | "permissions" | "deactivate" | null>(null);
  const [newRole, setNewRole] = useState<UserRole | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Fetch all users
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const token = localStorage.getItem("fmc-auth-token");
      const response = await fetch("/api/admin/users", {
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data.data || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  // Handle role change
  async function handleRoleChange() {
    if (!selectedUser || !newRole) return;

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token = localStorage.getItem("fmc-auth-token");
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newRole }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to change role");
      }

      const data = await response.json();
      setMessage(data.message);
      setAction(null);
      setNewRole(null);
      await fetchUsers();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error changing role");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle permission change
  async function handlePermissionChange() {
    if (!selectedUser) return;

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token = localStorage.getItem("fmc-auth-token");
      const response = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissions: selectedPermissions,
          action: "set",
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update permissions");
      }

      const data = await response.json();
      setMessage(data.message);
      setAction(null);
      setSelectedPermissions([]);
      await fetchUsers();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating permissions");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle deactivate
  async function handleDeactivate() {
    if (!selectedUser) return;

    const confirm = window.confirm(
      `Are you sure you want to deactivate ${selectedUser.email}? This will revoke all their access immediately.`
    );
    if (!confirm) return;

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token = localStorage.getItem("fmc-auth-token");
      const response = await fetch(`/api/admin/users/${selectedUser.id}/deactivate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to deactivate user");
      }

      const data = await response.json();
      setMessage(data.message);
      setAction(null);
      await fetchUsers();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deactivating user");
    } finally {
      setSubmitting(false);
    }
  }

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Loading users...</div>;
  }

  return (
    <div className="bg-gray-900 rounded-xl p-8 border border-gray-700">
      <h2 className="text-3xl font-bold text-white mb-6">User Management</h2>

      {message && (
        <div className="mb-4 p-4 bg-green-900 border border-green-700 rounded text-green-200">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-900 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-gray-300 font-semibold">Email</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Name</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Role</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Permissions</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 text-white">{user.email}</td>
                <td className="px-4 py-3 text-gray-300">{user.full_name || "N/A"}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === UserRole.HEAD
                      ? "bg-red-900 text-red-200"
                      : user.role === UserRole.CO_HEAD
                      ? "bg-orange-900 text-orange-200"
                      : user.role === UserRole.EXECUTIVE
                      ? "bg-blue-900 text-blue-200"
                      : user.role === UserRole.MEMBER
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-600 text-gray-300"
                  }`}>
                    {formatRole(user.role)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {user.role === UserRole.EXECUTIVE && user.permissions?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.map((perm) => (
                        <span key={perm} className="bg-gray-700 px-2 py-1 rounded">
                          {formatPermission(perm)}
                        </span>
                      ))}
                    </div>
                  ) : user.role === UserRole.HEAD || user.role === UserRole.CO_HEAD ? (
                    <span className="text-green-400">All</span>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setAction("role");
                      setNewRole(null);
                    }}
                    className="text-blue-400 hover:text-blue-300 mr-4 text-sm"
                  >
                    Change Role
                  </button>
                  {user.role === UserRole.EXECUTIVE && (
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setAction("permissions");
                        setSelectedPermissions(user.permissions || []);
                      }}
                      className="text-purple-400 hover:text-purple-300 mr-4 text-sm"
                    >
                      Permissions
                    </button>
                  )}
                  {user.role !== UserRole.INACTIVE && (
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setAction("deactivate");
                      }}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Change Modal */}
      {action === "role" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              Change Role: {selectedUser.email}
            </h3>
            <div className="space-y-3 mb-6">
              {Object.values(UserRole).map((role) => (
                <label key={role} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={newRole === role}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">{formatRole(role)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRoleChange}
                disabled={!newRole || submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                {submitting ? "Updating..." : "Update Role"}
              </button>
              <button
                onClick={() => {
                  setAction(null);
                  setSelectedUser(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {action === "permissions" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              Manage Permissions: {selectedUser.email}
            </h3>
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {getExecutivePermissions().map((perm) => (
                <label key={perm} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">{formatPermission(perm)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePermissionChange}
                disabled={submitting}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                {submitting ? "Updating..." : "Save Permissions"}
              </button>
              <button
                onClick={() => {
                  setAction(null);
                  setSelectedUser(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation */}
      {action === "deactivate" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-red-700">
            <h3 className="text-xl font-bold text-white mb-4">Deactivate User</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to deactivate <strong>{selectedUser.email}</strong>?
              <br />
              <br />
              This will immediately revoke all their access and permissions.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeactivate}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                {submitting ? "Deactivating..." : "Deactivate"}
              </button>
              <button
                onClick={() => {
                  setAction(null);
                  setSelectedUser(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
