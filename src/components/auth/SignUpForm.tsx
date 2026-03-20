"use client";

import { useState } from "react";
import { MASTER_EMAIL } from "@/lib/config";

interface SignUpFormProps {
  onOTPNeeded: (email: string, fullName: string, role: string) => void;
}

export default function SignUpForm({ onOTPNeeded }: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("member");
  const [invitationToken, setInvitationToken] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const isMaster = email.toLowerCase().trim() === MASTER_EMAIL.toLowerCase();
  const requiresInvitation = (role === "head" || role === "co_head") && !isMaster;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalized_email = email.toLowerCase().trim();

    // Validation
    if (!normalized_email.includes("@")) {
      setStatus("❌ Please enter a valid email");
      return;
    }

    if (!fullName.trim()) {
      setStatus("❌ Please enter your full name");
      return;
    }

    if (requiresInvitation && !invitationToken.trim()) {
      setStatus(`❌ ${role === "head" ? "Head" : "Co-Head"} role requires an invitation token`);
      return;
    }

    setLoading(true);
    setStatus("Creating account...");

    try {
      const payload: any = {
        email: normalized_email,
        full_name: fullName.trim(),
        role: role,
      };

      if (invitationToken.trim()) {
        payload.invitation_token = invitationToken.trim();
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`❌ ${data.error || "Registration failed"}`);
        setLoading(false);
        return;
      }

      if (data.success) {
        setStatus("✓ OTP sent to your email!");
        setTimeout(() => {
          onOTPNeeded(normalized_email, fullName, role);
        }, 500);
      } else {
        setStatus("❌ Registration failed");
        setLoading(false);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setStatus("❌ Connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@club.com"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40"
          disabled={loading}
          required
        />
        {isMaster && (
          <p className="text-xs text-yellow-400 mt-2">👑 Master account detected</p>
        )}
      </div>

      <div>
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Full Name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="John Doe"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40"
          disabled={loading}
          required
        />
      </div>

      <div>
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          disabled={loading}
        >
          <option value="member">Member (View photos)</option>
          <option value="executive">Executive (Manage events & photos)</option>
          <option value="co_head">Co-Head (Admin access)</option>
          <option value="head">Head (Full admin)</option>
        </select>
      </div>

      {requiresInvitation && (
        <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-200 text-sm">
          <p className="font-semibold mb-2">🔐 Invitation Token Required</p>
          <p className="text-xs mb-3">
            {role === "head"
              ? "Only the Master can invite new Heads. Ask them for an invitation token."
              : "Only the Master or Head can invite Co-Heads. Ask them for an invitation token."}
          </p>
          <input
            type="text"
            value={invitationToken}
            onChange={(e) => setInvitationToken(e.target.value)}
            placeholder="Paste your invitation token here"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            disabled={loading}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim() || !fullName.trim()}
        className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>

      {status && (
        <div className="p-3 rounded-lg bg-white/10 border border-white/20 text-center text-sm text-gray-200">
          {status}
        </div>
      )}
    </form>
  );
}
