/**
 * API Route: GET /api/admin/users
 * 
 * Get all users in the system
 * Only Head and Co-Head can access this
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireSupremeAdmin } from "@/lib/middleware";
import { Permission, User, UserRole } from "@/types";

export async function GET(request: NextRequest) {
  // Require Head or Co-Head
  const user = await requireSupremeAdmin(request);
  if (user instanceof Response) return user;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

    const users: User[] = data || [];

    return Response.json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Require Head or Co-Head
  const admin = await requireSupremeAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const body = await request.json();
    const email = String(body?.email || "").toLowerCase().trim();
    const role = String(body?.role || "").trim() as UserRole;
    const permissions = Array.isArray(body?.permissions) ? body.permissions : [];
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : null;

    if (!email || !email.includes("@")) {
      return Response.json({ error: "Valid email is required" }, { status: 400 });
    }

    const allowedRoles = Object.values(UserRole);
    if (!allowedRoles.includes(role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    const allowedPerms = new Set(Object.values(Permission));
    const sanitizedPerms = permissions.filter((perm: unknown) =>
      typeof perm === "string" && allowedPerms.has(perm as Permission)
    ) as Permission[];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const newUser: Partial<User> = {
      id: crypto.randomUUID(),
      email,
      role,
      permissions: role === UserRole.EXECUTIVE ? sanitizedPerms : [],
      full_name: fullName || undefined,
      created_by: admin.sub,
    };

    const { data, error } = await supabase
      .from("users")
      .insert(newUser)
      .select("*")
      .single();

    if (error) {
      console.error("Database error:", error);
      const message = error?.code === "23505"
        ? "Email already exists"
        : error.message || "Failed to create user";
      return Response.json({ error: message }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: "User created",
      user: data,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
