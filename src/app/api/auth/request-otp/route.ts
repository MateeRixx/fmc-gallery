/**
 * API Route: POST /api/auth/request-otp
 *
 * Request an OTP code for email-based authentication.
 * Generates 6-digit OTP and sends via email.
 * Rate Limited: 10 requests per minute per email
 */

import { rateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { generateOTP, storeOTP } from "@/lib/otp-utils";
import { sendOTPEmail } from "@/lib/email";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const RequestOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
  isLogin: z.boolean().optional(),
});

async function handler(request: Request) {
  try {
    const body = await request.json();

    // Validate
    const validated = RequestOTPSchema.parse(body);
    const email = validated.email.toLowerCase().trim();

    // If it's a login request, ensure the user exists before sending an OTP
    // If it's a signup request, ensure the user DOES NOT exist
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (validated.isLogin) {
        if (error || !user) {
          return Response.json(
            { error: "No account found. Please sign up first." },
            { status: 404 }
          );
        }
      } else {
        // It's a signup request, so user should NOT exist
        if (user) {
          return Response.json(
            { error: "Account already exists. Please log in instead." },
            { status: 409 }
          );
        }
      }
    }

    // Generate OTP
    const otp = generateOTP();
    console.log(`📧 OTP requested for ${email}: ${otp}`);

    // Store in database
    const storeResult = await storeOTP(email, otp);
    if (!storeResult.success) {
      const isRateLimit = storeResult.error?.includes("Too many");
      return Response.json(
        { error: storeResult.error || "Failed to generate OTP" },
        { status: isRateLimit ? 429 : 500 }
      );
    }

    // Send email
    const emailResult = await sendOTPEmail(email, otp);
    if (!emailResult.success) {
      console.error(`Failed to send OTP email to ${email}:`, emailResult.error);
      // Don't fail the request - OTP is stored and can be used
      // In production, you might want to return error
    }

    // Response
    return Response.json(
      {
        success: true,
        message: "OTP sent to your email",
        email: email,
        expiresIn: "10 minutes",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("OTP request error:", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid request",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to request OTP" },
      { status: 500 }
    );
  }
}

// Rate limit: 100 requests per minute (standard config)
export const POST = rateLimit(handler, rateLimitConfigs.standard);

      { error: "Failed to request OTP" },
      { status: 500 }
    );
  }
}

// Rate limit: 100 requests per minute (standard config)
export const POST = rateLimit(handler, rateLimitConfigs.standard);
