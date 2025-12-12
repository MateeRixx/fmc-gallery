// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ADMINS = ["mohit@fmc.com", "admin@fmc.com", "president@fmc.com"]; // ← add your emails here

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ADMINS.includes(email.toLowerCase())) {
      localStorage.setItem("fmc-admin", "true");
      router.push("/admin");
    } else {
      alert("Access denied — you're not an admin");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 border border-white/20 max-w-md w-full">
        <h1 className="text-5xl font-black text-white text-center mb-8">
          FMC ADMIN LOGIN
        </h1>
        <form onSubmit={handleLogin} className="space-y-8">
          <input
            type="email"
            placeholder="Enter your admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-6 py-4 bg-white/10 rounded-xl text-white placeholder-gray-400 border border-white/20 focus:border-purple-500 transition"
            required
          />
          <button
            type="submit"
            className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:scale-105 transition"
          >
            LOGIN AS ADMIN
          </button>
        </form>
        <p className="text-gray-400 text-center mt-6 text-sm">
          Only authorized FMC members can access admin panel
        </p>
      </div>
    </div>
  );
}