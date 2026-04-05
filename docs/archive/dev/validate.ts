/**
 * Zod validation schemas for API routes
 * Centralized input validation to prevent bad data from reaching handlers
 *
 * Usage in API routes:
 * const body = await req.json();
 * const validated = EmailSchema.parse(body);
 */

import { z } from "zod";

// ============= AUTH SCHEMAS =============

export const EmailSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const SignUpSchema = z.object({
  email: z.string().email("Invalid email format"),
  full_name: z.string().min(2, "Full name too short").max(100),
  role: z.enum(["member", "executive", "co_head", "head"]),
  invitation_token: z.string().optional(),
});

export const InvitationTokenSchema = z.object({
  invitation_token: z.string().uuid("Invalid token format"),
});

// ============= PHOTO & UPLOAD SCHEMAS =============

export const PhotoUploadSchema = z.object({
  type: z.literal("application/octet-stream").or(
    z.string().startsWith("image/")
  ),
  size: z.number().max(10 * 1024 * 1024, "File too large (max 10MB)"),
});

export const PhotoQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  event_id: z.string().uuid().optional(),
});

// ============= EVENT SCHEMAS =============

export const EventSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(1000).optional(),
  date: z.coerce.date(),
  location: z.string().max(200).optional(),
});

export const EventUpdateSchema = EventSchema.partial();

export const EventQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["date_asc", "date_desc", "title_asc"]).default("date_desc"),
});

// ============= FACE/CLUSTER SCHEMAS =============

export const FaceSearchSchema = z.object({
  query: z.array(z.number(), { message: "Query must be an array of numbers" }).min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  event_id: z.string().uuid().optional(),
  threshold: z
    .coerce
    .number()
    .min(0)
    .max(1)
    .default(0.8),
});

export const ClusterQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  event_id: z.string().uuid().optional(),
  sort: z.enum(["size_desc", "size_asc", "recent"]).default("size_desc"),
});

export const ClusterDetailSchema = z.object({
  clusterId: z.coerce.number().int().positive("Invalid cluster ID"),
});

export const ClusterPhotosSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  event_id: z.string().uuid().optional(),
});

// ============= ADMIN SCHEMAS =============

export const PermissionSchema = z.object({
  permission: z.enum([
    "canAddEvents",
    "canEditEvents",
    "canDeleteEvents",
    "canUploadPhotos",
    "canDeletePhotos",
    "canManageMembers",
    "canGrantPermissions",
    "canViewAnalytics",
    "canAccessAdminPanel",
  ]),
});

export const RoleSchema = z.enum(["member", "executive", "co_head", "head"]);

export const UserUpdateSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  role: RoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
});

export const InvitationSchema = z.object({
  email: z.string().email("Invalid email"),
  role: RoleSchema,
  expiresIn: z.coerce.number().int().min(1).default(7), // days
});

// ============= PROFILE SCHEMAS =============

export const ProfileSetupSchema = z.object({
  fullName: z.string().min(2, "Name too short").max(100),
});

export const ProfilePhotoSchema = z.object({
  contentType: z
    .string()
    .refine(
      (type) =>
        type.startsWith("image/") &&
        ["image/jpeg", "image/png", "image/webp"].includes(type),
      "Only JPEG, PNG, and WebP images allowed"
    ),
  size: z.number().max(5 * 1024 * 1024, "Profile photo too large (max 5MB)"),
});

// ============= UTILITY FUNCTIONS =============

/**
 * Safe parse that returns {success, data, error}
 * Better for API responses than throwing
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        error: error.issues[0]?.message || "Validation failed",
      };
    }
    return { success: false, data: null, error: "Unknown error" };
  }
}

/**
 * Validation error response helper
 */
export function validationErrorResponse(
  error: z.ZodError | string
) {
  const message =
    error instanceof z.ZodError
      ? error.issues[0]?.message || "Validation failed"
      : error;

  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
