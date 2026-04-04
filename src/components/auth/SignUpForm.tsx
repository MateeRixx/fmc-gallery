"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { MASTER_EMAIL } from "@/lib/config";
import GoogleSignUpButton from "./GoogleSignUpButton";

interface SignUpFormProps {
  onSuccess?: () => void;
}

export default function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("member");
  const [invitationToken, setInvitationToken] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

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
      // Step 1: Validate role/invitation and create user account
      const payload: any = {
        email: normalized_email,
        full_name: fullName.trim(),
        role: role,
      };

      if (invitationToken.trim()) {
        payload.invitation_token = invitationToken.trim();
      }

      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setStatus(`❌ ${registerData.error || "Registration failed"}`);
        setLoading(false);
        return;
      }

      // Step 2: Send magic link via NextAuth email provider
      const signInResult = await signIn("email", {
        email: normalized_email,
        redirect: false,
      });

      if (signInResult?.error) {
        setStatus(`❌ Could not send sign-in link: ${signInResult.error}`);
        setLoading(false);
        return;
      }

      // Success!
      setStatus("✓ Account created! Check your email for the sign-in link.");
      setLinkSent(true);
      setEmail("");
      setFullName("");
      setRole("member");
      setInvitationToken("");
      setLoading(false);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setStatus("");
      }, 5000);
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
        <div
          className={`p-3 rounded-lg border text-center text-sm ${
            linkSent
              ? "bg-green-500/20 border-green-500/50 text-green-200"
              : "bg-white/10 border-white/20 text-gray-200"
          }`}
        >
          {status}
        </div>
      )}

      {linkSent && (
        <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-200 text-xs">
          <p className="font-semibold mb-2">📧 What's next?</p>
          <p>We sent a sign-in link to your email address.</p>
          <p className="mt-2">Click the link to sign in instantly. No password or OTP needed!</p>
          <p className="mt-2 text-blue-300">Link expires in 24 hours.</p>
        </div>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-black text-gray-400">or sign up with Google</span>
        </div>
      </div>

      <GoogleSignUpButton variant="signup" fullWidth />
    </form>
  );
}
