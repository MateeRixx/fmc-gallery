"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeToken } from "@/lib/jwt";

interface SignInFormProps {
  onSuccess?: () => void;
}

export default function SignInForm({ onSuccess }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.toLowerCase().trim();

    if (!normalized.includes("@")) {
      setStatus("❌ Please enter a valid email");
      return;
    }

    setLoading(true);
    setStatus("Authenticating...");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`❌ ${data.error || "Login failed"}`);
        setLoading(false);
        return;
      }

      if (data.token) {
        storeToken(data.token);
        setStatus("✓ Login successful!");

        if (onSuccess) {
          onSuccess();
        } else {
          setTimeout(() => router.push("/admin"), 500);
        }
      } else {
        setStatus("❌ No token received");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
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
        {loading ? "Signing in..." : "Sign In"}
      </button>

      {status && (
        <div className="p-3 rounded-lg bg-white/10 border border-white/20 text-center text-sm text-gray-200">
          {status}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Existing members only. Need an account?<br />
        Contact your Head or Co-Head for an invitation.
      </p>
    </form>
  );
}
