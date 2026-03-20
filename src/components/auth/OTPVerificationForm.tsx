"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeToken } from "@/lib/jwt";

interface OTPVerificationFormProps {
  email: string;
  fullName: string;
  role: string;
  onBack: () => void;
}

export default function OTPVerificationForm({
  email,
  fullName,
  role,
  onBack,
}: OTPVerificationFormProps) {
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim() || otp.length !== 6) {
      setStatus("❌ Please enter a 6-digit OTP");
      return;
    }

    setLoading(true);
    setStatus("Verifying OTP...");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp_code: otp.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`❌ ${data.error || "OTP verification failed"}`);
        setLoading(false);
        return;
      }

      if (data.token) {
        storeToken(data.token);
        setStatus("✓ Account created! Redirecting...");
        setTimeout(() => router.push("/admin"), 1000);
      } else {
        setStatus("❌ No token received");
        setLoading(false);
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setStatus("❌ Connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setStatus("Resending OTP...");

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`❌ ${data.error || "Resend failed"}`);
        setResending(false);
        return;
      }

      setStatus("✓ New OTP sent to your email!");
      setOtp("");
      setResending(false);
    } catch (err) {
      console.error("Resend error:", err);
      setStatus("❌ Failed to resend OTP");
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleVerify} className="space-y-6">
      <div className="p-4 rounded-lg bg-white/10 border border-white/20">
        <p className="text-sm text-gray-300 mb-2">
          <span className="font-semibold">Account Details:</span>
        </p>
        <p className="text-xs text-gray-400">
          Email: <span className="text-white">{email}</span>
        </p>
        <p className="text-xs text-gray-400">
          Name: <span className="text-white">{fullName}</span>
        </p>
        <p className="text-xs text-gray-400">
          Role: <span className="text-white capitalize">{role.replace("_", " ")}</span>
        </p>
      </div>

      <div>
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Enter 6-Digit OTP
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Check your email for the OTP code
        </p>
        <input
          type="text"
          value={otp}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setOtp(value);
          }}
          placeholder="000000"
          maxLength={6}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40 text-center text-2xl font-mono tracking-widest"
          disabled={loading || resending}
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={loading || resending || otp.length !== 6}
        className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
      >
        {loading ? "Verifying..." : "Verify OTP"}
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading || resending}
          className="flex-1 bg-white/20 text-white font-semibold py-2 rounded-lg hover:bg-white/30 disabled:bg-gray-400 transition text-sm"
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={loading || resending}
          className="flex-1 bg-white/20 text-white font-semibold py-2 rounded-lg hover:bg-white/30 disabled:bg-gray-400 transition text-sm"
        >
          {resending ? "Sending..." : "Resend OTP"}
        </button>
      </div>

      {status && (
        <div className="p-3 rounded-lg bg-white/10 border border-white/20 text-center text-sm text-gray-200">
          {status}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        OTP expires in 10 minutes. You have 5 attempts.
      </p>
    </form>
  );
}
