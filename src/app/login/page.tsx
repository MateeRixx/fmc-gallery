// src/app/login/page.tsx
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
    // Always require email login when visiting the login page
    clearToken();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalized = email.toLowerCase().trim();

    // Strict validation - email MUST be provided
    if (!normalized) {
      setStatus("❌ Please enter an email address");
      return;
    }

    if (!normalized.includes("@")) {
      setStatus("❌ Please enter a valid email");
      return;
    }

    setLoading(true);
    setStatus("Authenticating...");

    try {
      // Call new login API
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalized }),
      });

      let data;
      const contentType = response.headers.get("content-type");
      
      try {
        data = await response.json();
      } catch (e) {
        console.error("Failed to parse response as JSON. Content-Type:", contentType, "Status:", response.status);
        setStatus("❌ Server error - invalid response");
        setLoading(false);
        return;
      }

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
              required
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
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
