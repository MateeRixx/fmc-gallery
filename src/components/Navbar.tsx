"use client";

// src/components/Navbar.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

type NavbarProps = {
  onEventsClick?: () => void;
  onHomeClick?: () => void;
};

export default function Navbar({ onEventsClick, onHomeClick }: NavbarProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("fmc-admin");
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string; expiry?: number };
        const valid =
          !!parsed?.email &&
          typeof parsed?.expiry === "number" &&
          parsed.expiry > Date.now();
        if (valid && parsed.email) {
          setIsAdmin(true);
          setAdminEmail(parsed.email);
        }
      }
    } catch {
      // Silent fail
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("fmc-admin");
    setIsAdmin(false);
    setAdminEmail("");
    router.push("/");
  };

  const handleEventsClick = () => {
    if (onEventsClick) {
      onEventsClick();
    } else {
      router.push("/#events");
    }
  };

  const handleHomeClick = () => {
    if (onHomeClick) {
      onHomeClick();
    } else {
      router.push("/");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <ul className="flex justify-between items-center space-x-12 text-lg font-medium">
          <div className="flex justify-center items-center space-x-12">
            <li>
              <button
                onClick={handleHomeClick}
                className="text-white hover:text-[#FFBF00] transition"
              >
                HOME
              </button>
            </li>

            <li>
              <button
                onClick={handleEventsClick}
                className="text-white hover:text-[#FFBF00] transition"
              >
                EVENTS
              </button>
            </li>

            <li>
              <Link
                href="/about"
                className="text-white hover:text-[#FFBF00] transition"
              >
                ABOUT US
              </Link>
            </li>
          </div>

          <div className="flex items-center space-x-6">
            {isAdmin ? (
              <>
                <div className="flex items-center gap-3 bg-purple-600/30 px-4 py-2 rounded-full border border-purple-500/50">
                  <div className="w-8 h-8 bg-linear-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {adminEmail.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white text-sm font-semibold hidden sm:inline">
                    {adminEmail.split("@")[0]}
                  </span>
                </div>
                <Link
                  href="/admin"
                  className="text-white hover:text-[#FFBF00] transition font-semibold"
                >
                  ADMIN
                </Link>
                <button
                  onClick={handleLogout}
                  className="group relative h-8 overflow-hidden overflow-x-hidden rounded-md bg-neutral-950 px-6 py-1 text-neutral-50 text-sm font-semibold"
                >
                  <span className="relative z-10">LOGOUT</span>
                  <span className="absolute inset-0 overflow-hidden rounded-md">
                    <span className="absolute left-0 aspect-square w-full origin-center -translate-x-full rounded-full bg-[#FFBF00] transition-all duration-500 group-hover:translate-x-0 group-hover:scale-150"></span>
                  </span>
                </button>
              </>
            ) : (
              <li>
                <Link
                  href="/login"
                  className="text-white hover:text-[#FFBF00] transition"
                >
                  LOGIN
                </Link>
              </li>
            )}
          </div>
        </ul>
      </div>
    </nav>
  );
}
