/**
 * Updated Login Page with RBAC System
 * 
 * Replace your existing login page with this version that:
 * 1. Calls the new /api/auth/login endpoint
 * 2. Stores JWT token in localStorage
 * 3. Uses JWT for subsequent authentication
 * 4. Respects user roles (can't login if inactive)
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storeToken, clearToken } from "@/lib/jwt";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem("fmc-auth-token");
    if (token) {
      // Optional: decode and verify token is still valid
      router.push("/admin");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("Authenticating...");

    const normalized = email.toLowerCase().trim();

    try {
      if (!normalized.includes("@")) {
        setStatus("Please enter a valid email");
        setLoading(false);
        return;
      }

      // Call new login API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalized }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`❌ ${data.error || "Login failed"}`);
        setLoading(false);
        return;
      }

      if (data.token) {
        // Store JWT token
        storeToken(data.token);
        setStatus("✓ Login successful!");
        setTimeout(() => {
          router.push("/admin");
        }, 500);
      }
    } catch (err) {
      console.error("Login error:", err);
      setStatus("❌ Connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setStatus("Logged out");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 max-w-md w-full border border-white/20">
        <h1 className="text-5xl font-black text-white text-center mb-2">
          FMC
        </h1>
        <p className="text-center text-gray-300 text-sm mb-8">Admin Login</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@club.com"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {status && (
          <div className="mt-6 p-3 rounded-lg bg-white/10 border border-white/20 text-center text-sm text-gray-200">
            {status}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>This system now uses Role-Based Access Control.</p>
          <p className="mt-2">Contact your Head or Co-Head for access.</p>
        </div>
      </div>
    </div>
  );
}
