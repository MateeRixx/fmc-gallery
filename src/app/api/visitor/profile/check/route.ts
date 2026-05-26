import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = getSupabaseAdmin();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if visitor profile exists
    const { data: profile, error } = await supabase
      .from("visitor_profiles")
      .select("id, profile_photo_url, aws_face_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking profile:", error);
      return NextResponse.json(
        { error: "Failed to check profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasProfile: !!profile,
      profile: profile || null,
    });
  } catch (error) {
    console.error("Profile check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
