import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return Response.json({ error: "No token provided" }, { status: 400 });
    }

    // Find the invite
    const { data: invite, error } = await supabase
      .from("invitations")
      .select("id, email, role, token, expires_at, is_used")
      .eq("token", token)
      .single();

    if (error || !invite) {
      console.error("verify-invite error:", error);
      return Response.json(
        { error: "Invitation not found", details: error?.message || "No invite returned" },
        { status: 404 }
      );
    }

    // Check if already used
    if (invite.is_used) {
      return Response.json(
        { error: "This invitation has already been used" },
        { status: 410 }
      );
    }

    // Check if expired
    const expiresAt = new Date(invite.expires_at);
    if (expiresAt < new Date()) {
      return Response.json(
        { error: "This invitation has expired" },
        { status: 410 }
      );
    }

    return Response.json(
      {
        data: {
          email: invite.email,
          role: invite.role,
          role_level: invite.role === "head" ? 3 : invite.role === "co_head" ? 2 : 1,
          valid: true,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Invite verification error:", err);
    return Response.json(
      { error: "Failed to verify invitation" },
      { status: 500 }
    );
  }
}
