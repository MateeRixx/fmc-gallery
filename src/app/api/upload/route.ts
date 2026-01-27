import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const dirRaw = (form.get("dir") as string) || "covers";
    const dir = dirRaw.replace(/\.\./g, "").replace(/^\/+|\/+$/g, "") || "covers";
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Basic size/type guard to reduce abuse
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      return Response.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "Only image uploads are allowed" }, { status: 415 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("event-images")
      .upload(path, file, { contentType: file.type });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("event-images").getPublicUrl(path);
    return Response.json({ url: data.publicUrl });
  } catch {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
