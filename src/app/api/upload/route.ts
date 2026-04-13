import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuthCompat } from "@/lib/auth-utils";
import { hasPermission, isSupremeAdmin } from "@/lib/rbac";
import { Permission } from "@/types";
import sharp from "sharp";

export async function POST(request: Request) {
  const authResult = await requireAuthCompat(request);
  if (authResult instanceof Response) return authResult;
  const canUpload =
    isSupremeAdmin(authResult.role) ||
    hasPermission(authResult, Permission.CAN_UPLOAD_PHOTOS);
  if (!canUpload) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

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

    const ext = "jpg"; // Convert everything to JPEG
    const mimeToExt = "image/jpeg";
    const path = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Apply high compression
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressedBuffer = await sharp(buffer)
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || "us-east-1";

    if (!bucketName || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return Response.json({ error: "AWS credentials or bucket name missing" }, { status: 500 });
    }

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: path,
        Body: compressedBuffer,
        ContentType: mimeToExt,
      }));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

    const cdnDomain = process.env.NEXT_PUBLIC_CDN_DOMAIN;
    const publicUrl = cdnDomain 
      ? `https://${cdnDomain}/${path}`
      : `https://${bucketName}.s3.${region}.amazonaws.com/${path}`;
    
    return Response.json({ url: publicUrl });
  } catch {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
