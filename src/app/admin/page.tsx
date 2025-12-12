// src/app/admin/page.tsx
import AdminForm from "@/components/AdminForm";
import Link from "next/link";

export default function AdminProtected() {
  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-7xl font-black mb-8">ADMIN PANEL</h1>
        <AdminForm />
        <Link href="/" className="inline-block mt-12 text-purple-400 hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

// Server-side protection
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export async function GET() {
  // This runs on server — if not logged in, redirect to login
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("fmc-admin") === "true";
  if (!isAdmin) redirect("/login");
  return null;
}