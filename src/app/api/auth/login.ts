/**
 * API Route: POST /api/auth/login
 * 
 * Authenticate a user and return a JWT token
 * The token includes role and permissions for quick authorization checks
 */

import { createClient } from "@supabase/supabase-js";
import { createJWT } from "@/lib/jwt";
import { User } from "@/types";

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

    // Validate email format
    if (!normalized.includes("@")) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // Demo/development mode - create a mock user
      const mockUser: User = {
        id: "demo-user-123",
        email: normalized,
        role: "head",
        permissions: [],
        full_name: "Demo Admin",
      };

      const token = createJWT(mockUser);

      return Response.json({
        success: true,
        message: "Login successful (demo mode)",
        token,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          full_name: mockUser.full_name,
        },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return Response.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    if (!user) {
      return Response.json(
        { error: "Email not authorized for access" },
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
  } catch (err) {
    console.error("Login error:", err);
    return Response.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
