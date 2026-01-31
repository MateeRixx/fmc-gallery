/**
 * API Route: POST /api/auth/login
 * 
 * Authenticate a user and return a JWT token
 * The token includes role and permissions for quick authorization checks
 */

import { createClient } from "@supabase/supabase-js";
import { createJWT } from "@/lib/jwt";
import { Permission, User, UserRole } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalized = email.toLowerCase().trim();

    // Validate email is not empty and has @ symbol
    if (!normalized || !normalized.includes("@")) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    console.log("🔍 Login attempt:", { original: email, normalized });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Try database first if credentials are available
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Look up user
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", normalized)
          .maybeSingle();

        console.log("🔍 Database query result:", { email: normalized, user, error });

        if (error) {
          console.error("Database error:", error);
          return Response.json(
            { error: `Database error: ${error.message || "Connection failed"}` },
            { status: 500 }
          );
        }

        if (!user) {
          return Response.json(
            { error: "Email not found in database" },
            { status: 401 }
          );
        }

        // User is inactive - no access
        if (user.role === "inactive") {
          return Response.json(
            { error: "Your account is inactive. Contact your administrator." },
            { status: 403 }
          );
        }

        // Create JWT token
        const token = createJWT(user);

        return Response.json({
          success: true,
          message: "Login successful",
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
          },
        });
      } catch (dbErr) {
        console.error("Database connection failed:", dbErr);
        // Fall through to dev mode if database connection fails
      }
    }

    // Fallback: Development mode - test users (when database is not configured)
    const testUsers: Record<string, Partial<User>> = {
      "head@club.com": { role: UserRole.HEAD, full_name: "Head Admin" },
      "cohead@club.com": { role: UserRole.CO_HEAD, full_name: "Co-Head Admin" },
      "executive@club.com": { 
        role: UserRole.EXECUTIVE, 
        full_name: "Executive",
        permissions: [Permission.CAN_ADD_EVENTS, Permission.CAN_UPLOAD_PHOTOS]
      },
      "member@club.com": { role: UserRole.MEMBER, full_name: "Club Member" },
    };

    const testUser = testUsers[normalized];
    if (testUser) {
      console.warn("⚠️  Development mode: Using test account");
      const mockUser: User = {
        id: `test-${normalized}`,
        email: normalized,
        role: testUser.role || UserRole.MEMBER,
        permissions: testUser.permissions || [],
        full_name: testUser.full_name || "Test User",
      };

      const token = createJWT(mockUser);
      return Response.json({
        success: true,
        message: "Login successful (development mode)",
        token,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          full_name: mockUser.full_name,
        },
      });
    } else {
      return Response.json(
        { error: `❌ Development mode: Try one of these: ${Object.keys(testUsers).join(", ")}` },
        { status: 401 }
      );
    }

  } catch (err) {
    console.error("Login error:", err);
    return Response.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
