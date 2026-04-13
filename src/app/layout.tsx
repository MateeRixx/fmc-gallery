// src/app/layout.tsx
import type { Metadata } from "next";
import './globals.css'
import SessionProvider from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Film & Media Club • RGIPT",
  description: "Official website of FMC RGIPT",
  icons: {
    icon: '/icons/favicon.ico?v=2',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-black text-white antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
