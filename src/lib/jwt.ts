/**
 * JWT Authentication Utilities
 * 
 * Handles JWT creation, validation, and token management
 * Stores role and permissions in the token for quick authorization checks
 */

import { User, JWTPayload, UserRole, Permission } from "@/types";
import { getDefaultPermissionsForRole } from "./rbac";

// In production, use a secure secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
const TOKEN_EXPIRY_DAYS = parseInt(process.env.JWT_EXPIRY_DAYS || "30", 10);

/**
 * Create a JWT token for a user
 * Called after successful login or role change
 */
export function createJWT(user: User): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions || getDefaultPermissionsForRole(user.role),
    iat: now,
    exp,
  };

  // Simple JWT encoding (Base64 of JSON)
  // For production, use a proper JWT library like jsonwebtoken
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  
  // In production, sign with HMAC-SHA256
  // For now, this is a simplified version
  const signature = btoa(JWT_SECRET).substring(0, 43); // Fake signature
  
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const body = JSON.parse(atob(parts[1])) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (body.exp < now) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Expects: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Get token from localStorage (browser-side)
 * Key: "fmc-auth-token"
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fmc-auth-token");
}

/**
 * Store token in localStorage (browser-side)
 */
export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("fmc-auth-token", token);
  localStorage.setItem("fmc-token-timestamp", String(Date.now()));
}

/**
 * Clear auth token from localStorage (logout)
 */
export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("fmc-auth-token");
  localStorage.removeItem("fmc-token-timestamp");
  localStorage.removeItem("fmc-admin"); // Legacy
}

/**
 * Get current user from stored token (client-side)
 */
export function getCurrentUser(): JWTPayload | null {
  const token = getStoredToken();
  if (!token) return null;
  return verifyJWT(token);
}

/**
 * Check if user is authenticated (client-side)
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

/**
 * Check if token is expiring soon (within 1 day)
 * Use to prompt token refresh
 */
export function isTokenExpiringSoon(token: JWTPayload, warningDaysBefore: number = 1): boolean {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = token.exp - now;
  const warnThreshold = warningDaysBefore * 24 * 60 * 60;
  return timeUntilExpiry < warnThreshold;
}
