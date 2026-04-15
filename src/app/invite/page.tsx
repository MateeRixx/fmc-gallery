"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import OTPSignupForm from "@/components/auth/OTPSignupForm";

interface InviteInfo {
  email: string;
  role_level: number;
  valid: boolean;
  message?: string;
}

const ROLE_LABELS = {
  1: "EXECUTIVE",
  2: "CO_HEAD",
  3: "HEAD",
};

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = searchParams?.get("token");

  // If already authenticated, redirect to admin interface
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/admin");
    }
  }, [status, session, router]);

  // Validate invite token
  useEffect(() => {
    if (!token) {
      setError("❌ No invitation token provided");
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  async function validateToken() {
    if (!token) {
      setError("❌ No invitation token provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/auth/verify-invite?token=${encodeURIComponent(token)}`, {
        method: "GET",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "❌ Invalid or expired invitation");
        setLoading(false);
        return;
      }

      setInvite(data.data);
      setLoading(false);
    } catch (err) {
      console.error("Token validation error:", err);
      setError("❌ Could not validate invitation");
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-8">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20">
        {/* Header */}
        <h1 className="text-4xl font-black text-white text-center mb-2">🎉 Welcome!</h1>
        <p className="text-center text-gray-300 text-sm mb-8">You've been invited to join FMC</p>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border text-sm bg-red-500/20 border-red-500/50 text-red-200">
            <p className="font-semibold">{error}</p>
            {error.includes("expired") && (
              <p className="mt-2 text-xs">
                Ask your HEAD or CO_HEAD to send you a new invitation.
              </p>
            )}
            <button
              onClick={() => router.push("/login")}
              className="mt-4 w-full px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded font-semibold text-sm transition"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Valid Invite State */}
        {invite && invite.valid && (
          <>
            {/* Invite Info */}
            <div className="mb-8 p-4 rounded-lg border border-green-500/50 bg-green-500/10 text-green-200">
              <p className="text-sm font-semibold mb-2">✓ Invitation verified!</p>
              <div className="text-xs space-y-1">
                <p>
                  <span className="opacity-75">Email:</span> {invite.email}
                </p>
                <p>
                  <span className="opacity-75">Role:</span>{" "}
                  {ROLE_LABELS[invite.role_level as keyof typeof ROLE_LABELS] || "Member"}
                </p>
              </div>
            </div>

            {/* Signup Form */}
            <OTPSignupForm
              prefilledEmail={invite.email}
              prefilledToken={token || ""}
            />

            {/* Info */}
            <div className="mt-8 p-3 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-200 text-xs">
              <p className="font-semibold mb-1">📧 Verify your email</p>
              <p>We'll send a 6-digit code to {invite.email}. Enter it to complete signup.</p>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>🔒 Your membership will be active immediately after signup</p>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading invitation...</p>
          </div>
        </div>
      }
    >
      <InvitePageContent />
    </Suspense>
  );
}
