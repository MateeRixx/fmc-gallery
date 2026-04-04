"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

interface Step {
  type: "email" | "otp" | "success";
}

interface OTPSignupFormProps {
  prefilledEmail?: string;
  prefilledToken?: string;
  hideTokenField?: boolean;
}

export default function OTPSignupForm({
  prefilledEmail = "",
  prefilledToken = "",
  hideTokenField = false
}: OTPSignupFormProps) {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>({ type: "email" });
  const [email, setEmail] = useState(prefilledEmail);
  const [fullName, setFullName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [otp, setOTP] = useState("");
  const [invitationToken, setInvitationToken] = useState(prefilledToken);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Get token from URL if not provided as prop
  useEffect(() => {
    if (!prefilledToken) {
      const urlToken = searchParams?.get("token");
      if (urlToken) {
        setInvitationToken(urlToken);
      }
    }
  }, [searchParams, prefilledToken]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setStatus("❌ File too large. Maximum size is 5MB.");
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setStatus("");
    }
  };

  // Step 1: Request OTP
  const handleRequestOTP = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const normalized = email.toLowerCase().trim();

    if (!normalized.includes("@")) {
      setStatus("❌ Please enter a valid email");
      return;
    }

    if (!fullName.trim()) {
      setStatus("❌ Please enter your full name");
      return;
    }

    setLoading(true);
    setStatus("Sending OTP...");

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for rate limit error
        if (res.status === 429) {
          const retryAfter = data.retryAfter || 60;
          setResendTimer(retryAfter);
          setStatus(`❌ Too many requests. Try again in ${retryAfter} seconds`);
        } else {
          setStatus(`❌ ${data.error || "Failed to send OTP"}`);
        }
        setLoading(false);
        return;
      }

      setResendTimer(60); // 60 seconds cooldown
      setStatus("✓ OTP sent to your email!");
      setStep({ type: "otp" });
      setLoading(false);
    } catch (err) {
      console.error("OTP request error:", err);
      setStatus("❌ Connection error. Please try again.");
      setLoading(false);
    }
  };

  // Step 2: Verify OTP + Create Account
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6 || !otp.match(/^\d{6}$/)) {
      setStatus("❌ Please enter a valid 6-digit OTP");
      return;
    }

    if (!photo) {
      setStatus("❌ Please upload a clear photo of your face");
      return;
    }

    setLoading(true);
    setStatus("Creating account...");

    try {
      const formData = new FormData();
      formData.append("email", email.toLowerCase().trim());
      formData.append("otp", otp);
      formData.append("full_name", fullName.trim());
      if (invitationToken.trim()) {
        formData.append("invitation_token", invitationToken.trim());
      }
      formData.append("photo", photo);

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(`❌ ${data.error || "Failed to verify OTP"}`);
        setLoading(false);
        return;
      }

      setStatus("✓ Account created! Signing you in...");

      // Sign in with credentials
      const signInResult = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        userId: data.userId,
        redirect: true,
        callbackUrl: "/",
      });

      if (signInResult?.error) {
        setStatus(`❌ Sign in failed: ${signInResult.error}`);
        setLoading(false);
      }
    } catch (err) {
      console.error("Account creation error:", err);
      setStatus("❌ Connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={step.type === "email" ? handleRequestOTP : handleVerifyOTP} className="space-y-6">
      {/* Email & Name Input */}
      {step.type === "email" && (
        <>
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Email Address
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
              Invitation Token (Optional)
            </label>
            <input
              type="text"
              value={invitationToken}
              onChange={(e) => setInvitationToken(e.target.value)}
              placeholder="Paste token from invite email"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40 text-sm"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-2">
              If you received an invitation from HEAD or CO-HEAD, paste the token here
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !fullName.trim()}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
          >
            {loading ? "Sending OTP..." : "Create Account"}
          </button>
        </>
      )}

      {/* OTP Input */}
      {step.type === "otp" && (
        <>
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              6-Digit OTP Code
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOTP(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40 text-center text-2xl tracking-widest font-mono"
              disabled={loading}
              required
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              Check your email for the 6-digit code
            </p>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Profile Photo (Required for Face Recognition)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white file:btn file:border-none file:mr-4 file:bg-white file:text-black file:rounded file:px-2 file:cursor-pointer"
              disabled={loading}
              required
            />
            {photoPreview && (
              <div className="mt-4 flex justify-center">
                <img
                  src={photoPreview}
                  alt="Profile Preview"
                  className="w-24 h-24 object-cover rounded-full border-2 border-white"
                />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 text-center">
              This photo will be used to automatically tag you in gallery photos.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:bg-gray-400 transition"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleRequestOTP}
              disabled={loading || resendTimer > 0}
              className="w-1/2 bg-white/10 text-white font-semibold py-2 rounded-lg hover:bg-white/20 transition disabled:opacity-50"
            >
              {resendTimer > 0 ? `Resend (${resendTimer}s)` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep({ type: "email" });
                setOTP("");
                setStatus("");
              }}
              disabled={loading}
              className="w-1/2 bg-white/10 text-white font-semibold py-2 rounded-lg hover:bg-white/20 transition"
            >
              Back
            </button>
          </div>
        </>
      )}

      {/* Status Message */}
      {status && (
        <div
          className={`p-3 rounded-lg border text-center text-sm ${
            status.includes("✓")
              ? "bg-green-500/20 border-green-500/50 text-green-200"
              : "bg-red-500/20 border-red-500/50 text-red-200"
          }`}
        >
          {status}
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-200 text-xs">
        <p className="font-semibold mb-1">🆕 No password required</p>
        <p>We'll verify your email with a 6-digit code. Then you're all set!</p>
      </div>
    </form>
  );
}
