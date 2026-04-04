"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Invitation {
  id: string;
  token: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  is_used: boolean;
  used_at: string | null;
}

export default function InvitationsPage() {
  const [targetEmail, setTargetEmail] = useState("");
  const [targetRole, setTargetRole] = useState("member");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  // Redirect if not authenticated
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  const handleGenerateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetEmail.includes("@")) {
      setStatus("❌ Please enter a valid email");
      return;
    }

    if (!targetRole) {
      setStatus("❌ Please select a role");
      return;
    }

    setLoading(true);
    setStatus("Generating invitation...");

    try {
      // NextAuth handles session via HttpOnly cookies, no need for manual token
      const response = await fetch("/api/auth/create-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_email: targetEmail.toLowerCase().trim(),
          target_role: targetRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`❌ ${data.error || "Failed to create invitation"}`);
        setLoading(false);
        return;
      }

      setStatus(`✓ Invitation created! Token: ${data.token}`);
      setTargetEmail("");
      setTargetRole("member");
      setLoading(false);
      loadInvitations(); // Refresh list
    } catch (err) {
      console.error("Error:", err);
      setStatus("❌ Connection error");
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      // NextAuth handles session via HttpOnly cookies
      const response = await fetch("/api/admin/invitations");

      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Error loading invitations:", err);
    }
    setLoadingInvitations(false);
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">📧 Manage Invitations</h1>
          <p className="text-gray-300">Generate and send invitation tokens to register new members</p>
        </div>

        {/* Create Invitation Form */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Generate New Invitation</h2>

          <form onSubmit={handleGenerateInvitation} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="user@email.com"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Role
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                  disabled={loading}
                >
                  <option value="member">Member</option>
                  <option value="executive">Executive</option>
                  <option value="co_head">Co-Head</option>
                  <option value="head">Head</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !targetEmail.trim()}
              className="w-full bg-white text-black font-bold py-2 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
            >
              {loading ? "Generating..." : "Generate Invitation"}
            </button>

            {status && (
              <div className="p-3 rounded-lg bg-white/10 border border-white/20 text-center text-sm text-gray-200 break-all">
                {status}
              </div>
            )}
          </form>
        </div>

        {/* Invitations List */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Recent Invitations</h2>
            <button
              onClick={loadInvitations}
              disabled={loadingInvitations}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:bg-gray-400 text-sm font-semibold"
            >
              {loadingInvitations ? "Loading..." : "Refresh"}
            </button>
          </div>

          {invitations.length === 0 ? (
            <p className="text-gray-400 text-sm">No invitations yet. Create one above!</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className={`p-4 rounded-lg border ${
                    inv.is_used
                      ? "bg-white/5 border-white/10"
                      : "bg-green-500/10 border-green-500/30"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="text-white font-semibold">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        Role: <span className="capitalize text-gray-300">{inv.role.replace("_", " ")}</span>
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        inv.is_used
                          ? "bg-gray-500 text-gray-100"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      {inv.is_used ? "Used" : "Pending"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={inv.token}
                      readOnly
                      className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-1 text-xs text-gray-300 font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(inv.token)}
                      className="px-3 py-1 bg-white/20 text-white rounded text-xs font-semibold hover:bg-white/30"
                    >
                      {copiedToken === inv.token ? "✓ Copied" : "Copy"}
                    </button>
                  </div>

                  <p className="text-xs text-gray-400">
                    Created: {formatDate(inv.created_at)} • Expires: {formatDate(inv.expires_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
