// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/events/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Checking...");
    const normalized = email.toLowerCase().trim();
    try {
      const { data } = await supabase
        .from("admins")
        .select("email")
        .eq("email", normalized)
        .single();
      if (data) {
        localStorage.setItem(
          "fmc-admin",
          JSON.stringify({ email: normalized, expiry: Date.now() + 86400000 })
        );
        router.push("/admin");
      } else {
        setStatus("Access denied");
      }
    } catch {
      setStatus("Access denied");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 max-w-md w-full border border-white/20">
        <h1 className="text-5xl font-black text-white text-center mb-8">
          FMC ADMIN LOGIN
        </h1>
        <form onSubmit={handleLogin} className="space-y-8">
          <input
            type="email"
            placeholder="Your admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-6 py-4 bg-white/10 rounded-xl text-white placeholder-gray-400 border border-white/20 focus:border-purple-500 transition"
            required
          />
          <button
            type="submit"
            className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold rounded-xl hover:scale-105 transition"
          >
            LOGIN
          </button>
          <p className="text-center text-white">{status}</p>
        </form>
      </div>
    </div>
  );
}
