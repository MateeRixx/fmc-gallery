"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import GoogleSignUpButton from "./GoogleSignUpButton";

interface SignInFormProps {
  onSuccess?: () => void;
}

export default function SignInForm({ onSuccess }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.toLowerCase().trim();

    if (!normalized.includes("@")) {
      setStatus("❌ Please enter a valid email");
      return;
    }

    setLoading(true);
    setStatus("Sending sign-in link...");

    try {
      const result = await signIn("email", {
        email: normalized,
        redirect: false,
      });

      if (result?.error) {
        setStatus(`❌ ${result.error}`);
        setLoading(false);
        return;
      }

      // Link sent successfully
      setStatus("✓ Check your email for the sign-in link!");
      setLinkSent(true);
      setEmail("");
      setLoading(false);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setStatus("");
      }, 5000);
    } catch (err) {
      console.error("Sign-in error:", err);
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
          autoComplete="email"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
      >
        {loading ? "Sending link..." : "Sign In with Email"}
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
          <p>We sent a sign-in link to <strong>{email}</strong></p>
          <p className="mt-2">Click the link in your email to sign in instantly. No password needed!</p>
          <p className="mt-2 text-blue-300">Link expires in 24 hours.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Existing members only. Need an account?<br />
        Contact your Head or Co-Head for an invitation.
      </p>

      {/* Google OAuth Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-black text-gray-400">or continue with Google</span>
        </div>
      </div>

      {/* Google Sign In Button */}
      <GoogleSignUpButton variant="signin" fullWidth />
    </form>
  );
}
