/**
 * API Route: POST /api/auth/register
 *
 * Create a new ADMIN user account.
 * - Executive/Member: Public signup (no invitation required)
 * - Head/Co-Head: Requires valid invitation token
 *
 * Magic link will be sent by NextAuth email provider after account creation.
 * Rate Limited: 20 requests per minute (strict)
 */

import { createClient } from "@supabase/supabase-js";
import { MASTER_EMAIL } from "@/lib/config";
import { rateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { SignUpSchema, validationErrorResponse } from "@/lib/validate";
import { z } from "zod";

async function handler(request: Request) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    let validated;
    try {
      validated = SignUpSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(error);
      }
      throw error;
    }

    const { email, full_name, role, invitation_token } = validated;
    const normalized_email = email.toLowerCase().trim();
    const normalized_role = role.toLowerCase();

    // ===== SECURITY CHECK: Head/Co-Head require invitation (EXCEPT MASTER) =====
    const isMaster = normalized_email === MASTER_EMAIL.toLowerCase();

    if ((normalized_role === "head" || normalized_role === "co_head") && !isMaster) {
      if (!invitation_token) {
        return Response.json(
          {
            error: `${normalized_role === "head" ? "Head" : "Co-Head"} role requires invitation token`,
          },
          { status: 403 }
        );
      }

      // Get service role key for invitation validation
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Validate invitation token exists and is valid
        const { data: inv_data, error: inv_error } = await supabase
          .from("invitations")
          .select("id, email, role, expires_at")
          .eq("token", invitation_token)
          .single();

        if (inv_error || !inv_data) {
          return Response.json(
            { error: "Invalid or expired invitation token" },
            { status: 403 }
          );
        }

        // Verify token hasn't expired
        const expiresAt = new Date(inv_data.expires_at);
        if (expiresAt < new Date()) {
          return Response.json(
            { error: "Invitation token has expired" },
            { status: 403 }
          );
        }

        // Verify token email matches signup email
        if (inv_data.email?.toLowerCase() !== normalized_email) {
          return Response.json(
            { error: "Invitation email does not match signup email" },
            { status: 403 }
          );
        }

        // Verify token is for matching role
        if (inv_data.role !== normalized_role) {
          return Response.json(
            {
              error: `Invitation is for ${inv_data.role} role, not ${normalized_role}`,
            },
            { status: 403 }
          );
        }
      }
    }

    // ===== CREATE/UPDATE USER IN DATABASE =====
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already exists
    const { data: existing_user, error: lookup_error } = await supabase
      .from("users")
      .select("id, user_type")
      .eq("email", normalized_email)
      .maybeSingle();

    if (lookup_error && lookup_error.code !== "PGRST116") {
      console.error("Database error:", lookup_error);
      return Response.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (existing_user) {
      // User already exists - NextAuth email flow will handle the session
      // Just return success so SignUpForm can proceed to signIn("email")
      return Response.json({
        success: true,
        message: "Account already exists. Check your email for sign-in link.",
        email: normalized_email,
      });
    }

    // Create new user account (ADMIN type for all sign-up users)
    const { data: new_user, error: create_error } = await supabase
      .from("users")
      .insert({
        email: normalized_email,
        full_name,
        user_type: "ADMIN", // All registered users are ADMIN unless granted VISITOR explicitly
        role: normalized_role, // head, co_head, executive, member
        is_verified: false, // Will be marked verified after email confirmation
      })
      .select("id")
      .single();

    if (create_error) {
      console.error("User creation error:", create_error);
      return Response.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // ===== SUCCESS RESPONSE =====
    return Response.json({
      success: true,
      message: "Account created. Check your email for sign-in link.",
      email: normalized_email,
      userId: new_user.id,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return Response.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 20 requests per minute per IP
export const POST = rateLimit(handler, rateLimitConfigs.strict);

