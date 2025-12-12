import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  revalidatePath(path);
  return Response.json({ revalidated: true, path });
}
