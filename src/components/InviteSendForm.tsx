"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

const ROLE_LEVELS = {
  1: "EXECUTIVE",
  2: "CO_HEAD",
  3: "HEAD",
};

const ROLE_DESCRIPTIONS = {
  1: "Can create events, manage photos, and view all content",
  2: "Can manage members, send invites, and all EXECUTIVE permissions",
  3: "Full admin access - can manage everything including transferring HEAD role",
};

export default function InviteSendForm() {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [roleLevel, setRoleLevel] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const userRoleLevel = (session?.user as any)?.roleLevel ?? -1;
  const canSendInvites = userRoleLevel >= 2; // CO_HEAD or HEAD

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalized = email.toLowerCase().trim();

    if (!normalized.includes("@")) {
      setError("❌ Please enter a valid email");
      return;
    }

    // Prevent inviting to higher role than user's own role
    if (roleLevel > userRoleLevel) {
      setError(
        `❌ You can only invite people to roles at your level or lower. Your role level: ${userRoleLevel}`
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          role_level: roleLevel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(`❌ ${data.error || "Failed to send invite"}`);
        setLoading(false);
        return;
      }

      setMessage(
        `✓ Invitation sent to ${normalized}! They can now sign up via the invite link.`
      );
      setEmail("");
      setRoleLevel(1);
      setLoading(false);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setMessage("");
      }, 5000);
    } catch (err) {
      console.error("Invite error:", err);
      setError("❌ Connection error. Please try again.");
      setLoading(false);
    }
  };

  if (!canSendInvites) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-red-200">
        <p className="font-semibold">🔒 Permission Denied</p>
        <p className="text-sm mt-2">
          Only CO_HEAD and HEAD can send invitations. Your current role level: {userRoleLevel}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Input */}
      <div>
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40"
          disabled={loading}
          required
        />
        <p className="text-xs text-gray-400 mt-2">
          They'll receive an email with a link to join
        </p>
      </div>

      {/* Role Selection */}
      <div>
        <label className="block text-gray-300 text-sm font-semibold mb-3">
          Role Level
        </label>
        <div className="space-y-2">
          {Object.entries(ROLE_LEVELS).map(([level, name]) => {
            const numLevel = parseInt(level);
            const isDisabled = numLevel > userRoleLevel;

            return (
              <label
                key={level}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed border-gray-700"
                    : roleLevel === numLevel
                    ? "border-white/40 bg-white/10"
                    : "border-white/20 hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={numLevel}
                  checked={roleLevel === numLevel}
                  onChange={(e) => setRoleLevel(parseInt(e.target.value))}
                  disabled={isDisabled}
                  className="w-4 h-4 mt-1 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-white font-semibold">{name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {ROLE_DESCRIPTIONS[numLevel as keyof typeof ROLE_DESCRIPTIONS]}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        {userRoleLevel < 3 && (
          <p className="text-xs text-gray-400 mt-3">
            ℹ️ You can only invite to roles at your level or below. You are {userRoleLevel === 2 ? "CO_HEAD" : "EXECUTIVE"}.
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
      >
        {loading ? "Sending Invite..." : "Send Invitation"}
      </button>

      {/* Messages */}
      {message && (
        <div className="p-4 rounded-lg border text-sm bg-green-500/20 border-green-500/50 text-green-200">
          {message}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border text-sm bg-red-500/20 border-red-500/50 text-red-200">
          {error}
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-200 text-xs">
        <p className="font-semibold mb-2">📧 How it works:</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>Enter their email and select a role</li>
          <li>We'll send them an invitation link</li>
          <li>They sign up with OTP and become a member</li>
          <li>They can start using the platform immediately</li>
        </ol>
      </div>
    </form>
  );
}
