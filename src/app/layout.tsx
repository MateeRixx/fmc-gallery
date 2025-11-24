// src/app/layout.tsx
import type { Metadata } from "next";
import './globals.css'

// Your Figma fonts
import { Ibarra_Real_Nova, Inter } from 'next/font/google'

const ibarra = Ibarra_Real_Nova({
  subsets: ['latin'],
  weight: ['600'],           // SemiBold
  variable: '--font-ibarra',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300'],           // Light
  variable: '--font-inter',
})

// Optional: Keep Geist if you want it as fallback, otherwise remove
// import { Geist, Geist_Mono } from "next/font/google";
// const geistSans = Geist({ ... });
// const geistMono = Geist_Mono({ ... });

export const metadata: Metadata = {
  title: "Film & Media Club • RGIPT",
  description: "Official website of FMC RGIPT",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibarra.variable} ${inter.variable}`}>
      <body className="font-sans bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}