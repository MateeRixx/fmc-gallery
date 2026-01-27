// src/app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

function authorize(request: Request): Response | null {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "Service misconfigured: ADMIN_API_TOKEN missing" },
      { status: 500 }
    );
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  try {
    const path = new URL(request.url).searchParams.get("path") || "/";
    revalidatePath(path);
    return Response.json({ revalidated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revalidate failed";
    console.error("POST /api/revalidate error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}