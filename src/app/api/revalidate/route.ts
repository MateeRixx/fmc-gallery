// src/app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const path = new URL(request.url).searchParams.get("path") || "/";
  revalidatePath(path);
  return Response.json({ revalidated: true });
}