"use client";

// src/components/Navbar.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";

type NavbarProps = {
  onEventsClick?: () => void;
  onHomeClick?: () => void;
};

export default function Navbar({ onEventsClick, onHomeClick }: NavbarProps) {
  const router = useRouter();

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
        <ul className="flex justify-center items-center space-x-12 text-lg font-medium">
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
            <Link href="/about" className="text-white hover:text-[#FFBF00] transition">
              ABOUT US
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}