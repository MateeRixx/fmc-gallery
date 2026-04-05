"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DeleteProfileButton() {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const isConfirmed = confirm(
      "Are you sure you want to delete your profile? This action will permanently remove your user account and face clusters. Actual event photos will not be deleted, but your identity will be untagged from them. This cannot be undone."
    );

    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/visitor/profile", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete profile");
      }

      // Automatically sign out after successful deletion
      await signOut({ redirect: false });
      router.push("/");
    } catch (error) {
      alert(`Error deleting profile: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-5 py-2.5 border border-red-500/40 bg-red-500/10 text-red-500 text-sm font-bold rounded-lg hover:bg-red-500/20 hover:border-red-500/60 disabled:opacity-50 transition shadow-sm"
    >
      {isDeleting ? "Deleting..." : "Delete Profile"}
    </button>
  );
}
