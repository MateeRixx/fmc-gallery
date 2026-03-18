"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt";
import SignInForm from "@/components/auth/SignInForm";
import SignUpForm from "@/components/auth/SignUpForm";
import OTPVerificationForm from "@/components/auth/OTPVerificationForm";

type AuthStep = "signin" | "signup" | "otp";

interface OTPStepData {
  email: string;
  fullName: string;
  role: string;
}

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [authStep, setAuthStep] = useState<AuthStep>("signin");
  const [otpData, setOtpData] = useState<OTPStepData | null>(null);
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to admin
    if (getCurrentUser()) {
      router.replace("/admin");
    }
  }, [router]);

  const handleSignUpOTPNeeded = (email: string, fullName: string, role: string) => {
    setOtpData({ email, fullName, role });
    setAuthStep("otp");
  };

  const handleBackToSignUp = () => {
    setAuthStep("signup");
    setOtpData(null);
  };

  const handleTabChange = (tab: "signin" | "signup") => {
    setActiveTab(tab);
    setAuthStep(tab === "signin" ? "signin" : "signup");
    setOtpData(null);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-8">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20">
        {/* Header */}
        <h1 className="text-5xl font-black text-white text-center mb-2">FMC</h1>
        <p className="text-center text-gray-300 text-sm mb-8">Gallery & Events Management</p>

        {/* Tabs - Only show when not in OTP step */}
        {authStep !== "otp" && (
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => handleTabChange("signin")}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition ${
                activeTab === "signin"
                  ? "bg-white text-black"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => handleTabChange("signup")}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition ${
                activeTab === "signup"
                  ? "bg-white text-black"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Content */}
        {authStep === "signin" && (
          <SignInForm
            onSuccess={() => {
              // Redirect handled by SignInForm itself
            }}
          />
        )}

        {authStep === "signup" && (
          <SignUpForm onOTPNeeded={handleSignUpOTPNeeded} />
        )}

        {authStep === "otp" && otpData && (
          <OTPVerificationForm
            email={otpData.email}
            fullName={otpData.fullName}
            role={otpData.role}
            onBack={handleBackToSignUp}
          />
        )}

        {/* Footer Info */}
        {authStep !== "otp" && (
          <div className="mt-8 text-center text-xs text-gray-400 space-y-2">
            <p>Role-Based Access Control enabled</p>
            {activeTab === "signin" && (
              <p>No account yet? Click "Sign Up" to create one.</p>
            )}
            {activeTab === "signup" && (
              <p>Already have an account? Click "Sign In".</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
