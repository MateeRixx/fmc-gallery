import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const dirRaw = (form.get("dir") as string) || "covers";
    const dir = dirRaw.replace(/\.\./g, "").replace(/^\/+|\/+$/g, "") || "covers";
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
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
