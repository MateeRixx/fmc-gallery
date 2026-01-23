// src/app/layout.tsx
import type { Metadata } from "next";
import './globals.css'

export const metadata: Metadata = {
  title: "Film & Media Club • RGIPT",
  description: "Official website of FMC RGIPT",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Ibarra+Real+Nova:wght@600;700&family=Hepta+Slab:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
