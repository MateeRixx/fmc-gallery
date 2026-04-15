"use client";

// src/components/Navbar.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type NavbarProps = {
  onEventsClick?: () => void;
  onHomeClick?: () => void;
};

export default function Navbar({ onEventsClick, onHomeClick }: NavbarProps) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-5">
        <ul className="flex flex-col md:flex-row justify-between items-center md:space-x-12 text-base md:text-lg font-medium gap-4 md:gap-0">
          <div className="flex justify-center items-center space-x-4 sm:space-x-8 md:space-x-12">
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

          <div className="flex flex-wrap justify-center items-center gap-3 sm:space-x-6 sm:gap-0">
            {session?.user ? (
              <>
                <div className="flex items-center gap-3 bg-purple-600/30 px-4 py-2 rounded-full border border-purple-500/50">
                  <div className="w-8 h-8 bg-linear-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {session.user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white text-sm font-semibold hidden sm:inline">
                    {session.user.email?.split("@")[0]}
                  </span>
                </div>
                <Link
                  href="/visitor/moments"
                  className="text-white hover:text-[#FFBF00] transition font-semibold"
                >
                  MY PHOTOS
                </Link>
                {((session.user as any)?.roleLevel > 0 || (session.user as any)?.roleName !== "VISITOR") && (
                  <Link
                    href="/admin"
                    className="text-white hover:text-[#FFBF00] transition font-semibold"
                  >
                    ADMIN
                  </Link>
                )}
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
