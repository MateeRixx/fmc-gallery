import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuth } from "@/lib/middleware";
import { hasPermission, isSupremeAdmin } from "@/lib/rbac";
import { Permission } from "@/types";

export async function POST(request: Request) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const canManage =
    isSupremeAdmin(authResult.role) ||
    hasPermission(authResult, Permission.CAN_ADD_EVENTS) ||
    hasPermission(authResult, Permission.CAN_EDIT_EVENTS);
  if (!canManage) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const body: unknown = await request.json();
    const slug =
      body && typeof body === "object" && "slug" in body
        ? String((body as Record<string, unknown>).slug)
        : undefined;
    const excludeId =
      body && typeof body === "object" && "excludeId" in body
        ? (body as Record<string, unknown>).excludeId
        : undefined;

    if (!slug || typeof slug !== "string") {
      return Response.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (err: unknown) {
      console.error("Supabase initialization error:", err);
      return Response.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }
    
    let query = supabase
      .from("events")
      .select("id")
      .eq("slug", slug.toLowerCase().trim());

    if (excludeId !== undefined && excludeId !== null) {
      if (typeof excludeId === "string" || typeof excludeId === "number") {
        query = query.neq("id", excludeId as string | number);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Slug check error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }

    return Response.json({ exists: !!data });
  } catch (err: unknown) {
    console.error("API error:", err);
    const message = err instanceof Error ? err.message : String(err ?? "Internal server error");
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}
