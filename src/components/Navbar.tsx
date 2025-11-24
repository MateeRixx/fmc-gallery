// src/components/Navbar.tsx
import Link from 'next/link'

type NavbarProps = {
  onEventsClick?: () => void   // ← ? makes it optional
}

export default function Navbar({ onEventsClick }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <ul className="flex justify-center space-x-12 text-lg font-medium">
          <li>
            <Link href="/" className="text-white hover:text-purple-400 transition">
              HOME
            </Link>
          </li>
          <li>
            <button
              onClick={onEventsClick}
              className="text-white hover:text-purple-400 transition font-medium"
            >
              EVENTS
            </button>
          </li>
          <li>
            <Link href="/about" className="text-white hover:text-purple-400 transition">
              ABOUT US
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}