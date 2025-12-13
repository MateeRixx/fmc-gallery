// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/events/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Checking access...");
    const normalized = email.toLowerCase().trim();

    try {
      if (setupCode && setupCode === (process.env.NEXT_PUBLIC_ADMIN_SETUP_CODE || "")) {
        const { error: insertErr } = await supabase
          .from("admins")
          .insert({ email: normalized });
        if (insertErr) {
          setStatus("Failed to add admin");
          return;
        }
        localStorage.setItem("fmc-admin", "true");
        router.push("/admin");
        return;
      }

      const { data, error } = await supabase
        .from("admins")
        .select("email")
        .eq("email", normalized)
        .maybeSingle();

      if (error) {
        setStatus("Login error");
        return;
      }

      if (data) {
        localStorage.setItem("fmc-admin", "true");
        router.push("/admin");
      } else {
        setStatus("Not authorized — request access below");
      }
    } catch {
      setStatus("Unexpected error");
    }
  }

  async function handleRequestAccess() {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return;
    setStatus("Requesting access...");
    try {
      const { error } = await supabase
        .from("admin_requests")
        .insert({ email: normalized });
      if (error) {
        setStatus("Failed to request access");
        return;
      }
      setStatus("Request sent — an admin will approve you");
    } catch {
      setStatus("Unexpected error");
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 border border-white/20 max-w-md w-full">
        <h1 className="text-5xl font-black text-white text-center mb-8">FMC ADMIN LOGIN</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <input
            type="email"
            placeholder="Enter your admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-6 py-4 bg-white/10 rounded-xl text-white placeholder-gray-400 border border-white/20 focus:border-purple-500 transition"
            required
          />
          <input
            type="text"
            placeholder="Setup Code (optional)"
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            className="w-full px-6 py-4 bg-white/10 rounded-xl text-white placeholder-gray-400 border border-white/20"
          />
          <button type="submit" className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:scale-105 transition">
            LOGIN AS ADMIN
          </button>
        </form>
        <div className="mt-6 flex items-center justify-between">
          <button onClick={handleRequestAccess} className="text-purple-300 hover:underline">
            Request Access
          </button>
          <span className="text-sm text-gray-400">{status}</span>
        </div>
        <p className="text-gray-400 text-center mt-6 text-sm">Only authorized FMC members can access admin panel</p>
      </div>
    </div>
  );
}
