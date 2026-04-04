"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import OTPLoginForm from "@/components/auth/OTPLoginForm";
import OTPSignupForm from "@/components/auth/OTPSignupForm";

function LoginPageContent() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [signupType, setSignupType] = useState<"member" | "visitor" | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Check for invitation token in URL
  useEffect(() => {
    const token = searchParams?.get("token");
    if (token) {
      setActiveTab("signup");
      setSignupType("member");
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-8">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20">
        {/* Header */}
        <h1 className="text-5xl font-black text-white text-center mb-2">FMC</h1>
        <p className="text-center text-gray-300 text-sm mb-8">Gallery & Events Management</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("signin")}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition ${
              activeTab === "signin"
                ? "bg-white text-black"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab("signup")}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition ${
              activeTab === "signup"
                ? "bg-white text-black"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Content - OTP Based Forms */}
        {activeTab === "signin" && <OTPLoginForm />}

        {activeTab === "signup" && !signupType && (
          <div className="space-y-6">
            <p className="text-center text-gray-300 text-sm mb-6">Choose how you want to join:</p>

            <button
              onClick={() => setSignupType("member")}
              className="w-full p-4 rounded-lg border-2 border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-white transition"
            >
              <p className="font-bold text-lg mb-1">👤 Invited Member</p>
              <p className="text-xs text-gray-300">I have an invitation token from HEAD or CO-HEAD</p>
            </button>

            <button
              onClick={() => setSignupType("visitor")}
              className="w-full p-4 rounded-lg border-2 border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-white transition"
            >
              <p className="font-bold text-lg mb-1">🌐 Visitor</p>
              <p className="text-xs text-gray-300">Sign up as a visitor without an invitation</p>
            </button>

            <button
              onClick={() => setActiveTab("signin")}
              className="w-full text-sm text-gray-400 hover:text-gray-200 transition"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {activeTab === "signup" && signupType && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSignupType(null)}
                className="text-gray-400 hover:text-gray-200 text-sm"
              >
                ← Back
              </button>
              <span className="text-sm text-gray-400">
                {signupType === "member" ? "👤 Invited Member" : "🌐 Visitor"}
              </span>
            </div>
            <OTPSignupForm />
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-gray-400 space-y-2">
          <p>🔒 OTP-based authentication</p>
          {activeTab === "signin" && <p>No account yet? Click "Sign Up" to create one.</p>}
          {activeTab === "signup" && !signupType && <p>Choose your signup method above.</p>}
          {activeTab === "signup" && signupType && (
            <p>{signupType === "member" ? "Paste your invitation token to continue." : "Sign up as a visitor without needing an invite."}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

