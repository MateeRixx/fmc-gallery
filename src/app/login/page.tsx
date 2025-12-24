// src/app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    try {
      const raw = localStorage.getItem("fmc-admin");
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string; expiry?: number };
        const valid = !!parsed?.email && typeof parsed?.expiry === "number" && parsed.expiry > Date.now();
        if (valid) {
          router.push("/admin");
        }
      }
    } catch {
      // Silent fail
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("Checking credentials...");
    const normalized = email.toLowerCase().trim();
    
    try {
      if (!normalized.includes("@")) {
        setStatus("Please enter a valid email");
        setLoading(false);
        return;
      }

      const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!isConfigured) {
        // Demo mode
        localStorage.setItem(
          "fmc-admin",
          JSON.stringify({ email: normalized || "admin", expiry: Date.now() + 30 * 24 * 60 * 60 * 1000 })
        );
        setStatus("✓ Login successful!");
        setTimeout(() => {
          window.location.href = "/admin";
        }, 500);
        return;
      }

      const { data, error } = await supabase
        .from("admins")
        .select("email")
        .eq("email", normalized)
        .maybeSingle();

      if (error) {
        console.error("Database error:", error);
        setStatus("Database connection failed. Try again.");
        setLoading(false);
        return;
      }

      if (data?.email) {
        localStorage.setItem(
          "fmc-admin",
          JSON.stringify({ email: normalized, expiry: Date.now() + 30 * 24 * 60 * 60 * 1000 })
        );
        setStatus("✓ Login successful!");
        setTimeout(() => {
          window.location.href = "/admin";
        }, 500);
      } else {
        setStatus("❌ Email not authorized for admin access");
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
            <label className="text-white text-sm font-semibold mb-2 block">Admin Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 bg-white/10 rounded-xl text-white placeholder-gray-500 border border-white/20 focus:border-purple-500 transition focus:outline-none"
              required
              disabled={loading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-linear-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "SIGN IN"}
          </button>
          
          <div className="text-center">
            {status && (
              <p className={`text-sm font-semibold ${status.includes("✓") ? "text-green-400" : status.includes("❌") ? "text-red-400" : "text-yellow-400"}`}>
                {status}
              </p>
            )}
          </div>

          <div className="text-center pt-4 border-t border-white/20">
            <p className="text-gray-400 text-xs">
              Only authorized admin emails can access
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
