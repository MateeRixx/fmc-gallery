import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Extract real IP from headers in Edge environments (like Vercel)
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  
  // NOTE: For true distributed edge rate-limiting, use @upstash/ratelimit.
  // Vercel's Edge Network already provides built-in Layer 3 & 4 DDoS protection
  // and load balancing automatically.

  // Basic security enforcement example: block obvious malicious user agents
  const userAgent = req.headers.get("user-agent")?.toLowerCase();
  const blockedAgents = ["sqlmap", "nmap", "nikto", "curl", "wget"];
  
  if (userAgent && blockedAgents.some(agent => userAgent.includes(agent))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

// Config to apply middleware to specific essential routes
export const config = {
  matcher: [
    "/api/:path*",
    "/login",
    "/visitor/login"
  ],
};
