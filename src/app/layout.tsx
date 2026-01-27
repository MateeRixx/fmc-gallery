// src/app/layout.tsx
import type { Metadata } from "next";
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ 
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Film & Media Club • RGIPT",
  description: "Official website of FMC RGIPT",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="font-sans bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
