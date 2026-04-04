/**
 * Rate limiting utility for API routes
 * Prevents abuse by limiting requests per IP address
 *
 * Usage:
 * export const POST = rateLimit(
 *   async (req) => { ... },
 *   { limit: 20, window: 60 } // 20 requests per 60 seconds
 * );
 */

import { headers } from "next/headers";

interface RateLimitConfig {
  limit: number; // Max requests
  window: number; // Time window in seconds
}

// In-memory store for rate limiting
// In production, use Redis (Upstash) for distributed rate limiting
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

/**
 * Get client IP address from request headers
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0] ||
    headersList.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check if client is rate limited
 * Returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    const resetTime = now + config.window * 1000;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.limit - 1, resetAt: resetTime };
  }

  // Existing window
  const remaining = config.limit - entry.count;

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: remaining - 1, resetAt: entry.resetTime };
}

/**
 * Wrap API route handler with rate limiting
 *
 * Usage:
 * export const POST = rateLimit(
 *   async (req) => Response.json({ success: true }),
 *   { limit: 20, window: 60 }
 * );
 */
export function rateLimit(
  handler: (req: Request) => Promise<Response>,
  config: RateLimitConfig
) {
  return async (req: Request) => {
    const clientIp = await getClientIp();
    const key = `${clientIp}:${req.url}`;

    const { allowed, remaining, resetAt } = checkRateLimit(key, config);

    if (!allowed) {
      const resetInSeconds = Math.ceil((resetAt - Date.now()) / 1000);
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          retryAfter: resetInSeconds,
        }),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            "Retry-After": String(resetInSeconds),
          },
        }
      );
    }

    // Call handler and add rate limit headers to response
    const response = await handler(req);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("X-RateLimit-Limit", String(config.limit));
    newResponse.headers.set("X-RateLimit-Remaining", String(remaining));
    newResponse.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    return newResponse;
  };
}

/**
 * Common rate limit configurations
 */
export const rateLimitConfigs = {
  standard: { limit: 100, window: 60 }, // 100 per minute
  strict: { limit: 20, window: 60 }, // 20 per minute (login/signup)
  veryStrict: { limit: 5, window: 60 }, // 5 per minute (clustering, heavy ops)
  relaxed: { limit: 1000, window: 3600 }, // 1000 per hour
};

/**
 * Clean up old entries from rate limit store (call periodically)
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}
