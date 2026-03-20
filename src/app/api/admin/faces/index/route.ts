import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/middleware";
import { Permission } from "@/types";

type FacePayload = {
  photo_id: string;
  event_id: string;
  embedding: number[];
  bbox: { x: number; y: number; width: number; height: number };
  quality_score?: number;
};

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, Permission.CAN_UPLOAD_PHOTOS);
  if (user instanceof Response) return user;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Service misconfigured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await request.json();
    const faces = body?.faces as FacePayload[] | undefined;

    if (!faces || !Array.isArray(faces) || faces.length === 0) {
      return Response.json({ error: "faces array is required" }, { status: 400 });
    }

    for (const face of faces) {
      if (!face.photo_id || !face.event_id) {
        return Response.json({ error: "photo_id and event_id are required" }, { status: 400 });
      }

      if (!Array.isArray(face.embedding) || face.embedding.length !== 128) {
        return Response.json({ error: "embedding must be length 128" }, { status: 400 });
      }

      if (!face.bbox || typeof face.bbox !== "object") {
        return Response.json({ error: "bbox is required" }, { status: 400 });
      }
    }

    const rows = faces.map((face) => ({
      photo_id: face.photo_id,
      event_id: face.event_id,
      embedding: `[${face.embedding.join(",")}]`,
      bbox: face.bbox,
      quality_score: face.quality_score ?? 0,
    }));

    const { error } = await supabase.from("face_embeddings").insert(rows);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, indexed: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Index failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
