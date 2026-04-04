"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GoogleSignUpButton from "@/components/auth/GoogleSignUpButton";

export default function VisitorLoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      checkProfile();
    }
  }, [status]);

  const checkProfile = async () => {
    try {
      const response = await fetch("/api/visitor/profile/check");
      const data = await response.json();

      if (data.hasProfile) {
        router.push("/gallery");
      } else {
        router.push("/visitor/profile-setup");
      }
    } catch (error) {
      console.error("Error checking profile:", error);
      router.push("/visitor/profile-setup");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mx-auto"></div>
          <p className="mt-4 text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Find Your Photos</h1>
          <p className="text-gray-400 text-sm mb-6">
            Sign in with your Google account to find photos of yourself from our events
          </p>

          <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30 mb-6">
            <ul className="text-sm text-blue-100 space-y-2 text-left">
              <li className="flex items-center space-x-2">
                <span>✓</span> <span>Upload your profile photo</span>
              </li>
              <li className="flex items-center space-x-2">
                <span>✓</span> <span>We find your face in event photos</span>
              </li>
              <li className="flex items-center space-x-2">
                <span>✓</span> <span>Download your personalized gallery</span>
              </li>
            </ul>
          </div>

          <GoogleSignUpButton variant="signup" fullWidth />

          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-gray-400 text-sm mb-3">Club admin or manager?</p>
            <a
              href="/login"
              className="inline-block w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition border border-white/20 text-sm"
            >
              Admin Login →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
