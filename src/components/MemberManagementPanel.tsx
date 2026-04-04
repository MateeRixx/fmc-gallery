"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role_level: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
}

const ROLE_LEVELS = {
  0: { name: "VISITOR", label: "Visitor", color: "gray" },
  1: { name: "EXECUTIVE", label: "Executive", color: "blue" },
  2: { name: "CO_HEAD", label: "Co-Head", color: "orange" },
  3: { name: "HEAD", label: "Head", color: "red" },
};

export default function MemberManagementPanel() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [action, setAction] = useState<"promote" | "demote" | "deactivate" | "transfer-head" | null>(null);
  const [newRoleLevel, setNewRoleLevel] = useState<number | null>(null);
  const [newHeadId, setNewHeadId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const userRoleLevel = (session?.user as any)?.roleLevel ?? -1;
  const canManageMembers = userRoleLevel >= 2; // CO_HEAD or HEAD

  useEffect(() => {
    if (canManageMembers) {
      fetchMembers();
    }
  }, [canManageMembers]);

  async function fetchMembers() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/members");

      if (!response.ok) {
        throw new Error(`Failed to fetch members: ${response.statusText}`);
      }

      const data = await response.json();
      setMembers(data.data || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch members");
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote() {
    if (!selectedMember || newRoleLevel === null || newRoleLevel === selectedMember.role_level) return;

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const response = await fetch(`/api/admin/members/${selectedMember.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_level: newRoleLevel }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to promote member");
      }

      const data = await response.json();
      setMessage(`✓ Promoted to ${ROLE_LEVELS[newRoleLevel as keyof typeof ROLE_LEVELS].label}`);
      setAction(null);
      setNewRoleLevel(null);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error promoting member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!selectedMember) return;

    const confirm = window.confirm(
      `Deactivate ${selectedMember.email}? They will lose all access immediately.`
    );
    if (!confirm) return;

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const response = await fetch(`/api/admin/members/${selectedMember.id}/deactivate`, {
        method: "POST",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to deactivate member");
      }

      const data = await response.json();
      setMessage(`✓ ${selectedMember.email} has been deactivated`);
      setAction(null);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deactivating member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransferHead() {
    if (!newHeadId) return;

    const newHead = members.find((m) => m.id === newHeadId);
    if (!newHead) return;

    const confirm = window.confirm(
      `Transfer HEAD role to ${newHead.email}? You will become CO_HEAD.`
    );
    if (!confirm) return;

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const response = await fetch(`/api/admin/members/${newHeadId}/transfer-head`, {
        method: "POST",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to transfer HEAD role");
      }

      const data = await response.json();
      setMessage(`✓ HEAD role transferred to ${newHead.email}`);
      setAction(null);
      setNewHeadId("");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error transferring HEAD role");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canManageMembers) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 border border-red-700 text-red-200">
        <p>❌ You don't have permission to manage members. Only CO_HEAD and HEAD can access this.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Loading members...</div>;
  }

  const currentHead = members.find((m) => m.role_level === 3 && m.is_active);

  return (
    <div className="bg-gray-900 rounded-xl p-8 border border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Member Management</h2>
          <p className="text-sm text-gray-400 mt-1">{members.length} total members</p>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="p-4 bg-green-900 border border-green-700 rounded text-green-200 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-900 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Members Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-gray-300 font-semibold">Email</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Name</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Role</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Status</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Joined</th>
              <th className="px-4 py-3 text-gray-300 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const roleInfo = ROLE_LEVELS[member.role_level as keyof typeof ROLE_LEVELS] || ROLE_LEVELS[0];
              const colorClass = {
                red: "bg-red-900 text-red-200",
                orange: "bg-orange-900 text-orange-200",
                blue: "bg-blue-900 text-blue-200",
                gray: "bg-gray-700 text-gray-200",
              }[roleInfo.color];

              return (
                <tr key={member.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-white">{member.email}</td>
                  <td className="px-4 py-3 text-gray-300">{member.full_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                      {roleInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        member.is_active
                          ? "bg-green-900 text-green-200"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {member.is_active ? "✓ Active" : "✗ Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(member.start_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    {member.is_active && member.role_level < 2 && userRoleLevel >= 2 && (
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setAction("promote");
                          setNewRoleLevel(null);
                        }}
                        className="text-green-400 hover:text-green-300 text-sm font-semibold"
                      >
                        Promote
                      </button>
                    )}
                    {member.role_level >= 2 && userRoleLevel >= 2 && (
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setAction("demote");
                          setNewRoleLevel(null);
                        }}
                        className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold"
                      >
                        Demote
                      </button>
                    )}
                    {member.is_active && member.role_level !== 3 && (
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setAction("deactivate");
                        }}
                        className="text-red-400 hover:text-red-300 text-sm font-semibold"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Head Control (only for current HEAD) */}
      {userRoleLevel === 3 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-yellow-700/50">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">👑 HEAD Controls</h3>
          <button
            onClick={() => setAction("transfer-head")}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-semibold text-sm"
          >
            Transfer HEAD Role to Another Member
          </button>
        </div>
      )}

      {/* Promote/Demote Modal */}
      {(action === "promote" || action === "demote") && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {action === "promote" ? "Promote" : "Change Role"}: {selectedMember.email}
            </h3>
            <div className="space-y-3 mb-6">
              {[0, 1, 2, 3].map((level) => {
                const isCurrentRole = level === selectedMember.role_level;
                const isAboveUser = level > userRoleLevel;
                const info = ROLE_LEVELS[level as keyof typeof ROLE_LEVELS];

                return (
                  <label
                    key={level}
                    className={`flex items-center gap-3 p-3 rounded border ${
                      isAboveUser
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-gray-700"
                    } ${newRoleLevel === level ? "border-blue-500 bg-blue-900/20" : "border-gray-700"}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={level}
                      checked={newRoleLevel === level}
                      onChange={(e) => setNewRoleLevel(parseInt(e.target.value))}
                      disabled={isAboveUser}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-white font-semibold">{info.label}</span>
                      {isCurrentRole && <span className="text-gray-400 text-xs ml-2">(current)</span>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePromote}
                disabled={newRoleLevel === null || newRoleLevel === selectedMember.role_level || submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                {submitting ? "Updating..." : "Update"}
              </button>
              <button
                onClick={() => {
                  setAction(null);
                  setSelectedMember(null);
                  setNewRoleLevel(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {action === "deactivate" && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-red-700">
            <h3 className="text-xl font-bold text-white mb-4">Deactivate Member</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to deactivate <strong>{selectedMember.email}</strong>?
              <br />
              <br />
              They will immediately lose all access and permissions.
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
                  setSelectedMember(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer HEAD Modal */}
      {action === "transfer-head" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-yellow-700">
            <h3 className="text-xl font-bold text-white mb-4">Transfer HEAD Role</h3>
            <p className="text-gray-300 mb-4">Select who should become the new HEAD:</p>
            <div className="space-y-2 mb-6 max-h-72 overflow-y-auto">
              {members
                .filter((m) => m.is_active && m.role_level >= 1 && m.role_level !== 3)
                .map((member) => (
                  <label
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded border cursor-pointer hover:bg-gray-700 ${
                      newHeadId === member.id ? "border-yellow-500 bg-yellow-900/20" : "border-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="newhead"
                      value={member.id}
                      checked={newHeadId === member.id}
                      onChange={(e) => setNewHeadId(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-white font-semibold">{member.email}</span>
                      <span className="text-gray-400 text-xs ml-2">{member.full_name || "—"}</span>
                    </div>
                  </label>
                ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleTransferHead}
                disabled={!newHeadId || submitting}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                {submitting ? "Transferring..." : "Transfer"}
              </button>
              <button
                onClick={() => {
                  setAction(null);
                  setNewHeadId("");
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
