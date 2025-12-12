"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminForm from "@/components/AdminForm";

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    const isAdmin = localStorage.getItem("fmc-admin") === "true";
    if (!isAdmin) router.replace("/login");
  }, [router]);
  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-7xl font-black mb-8">ADMIN PANEL</h1>
        <AdminForm />
      </div>
    </div>
  );
}
