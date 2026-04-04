/**
 * API Route: POST /api/admin/members/[id]/transfer-head
 *
 * Transfer HEAD role to another member
 * Only callable by current HEAD
 * Deactivates current HEAD and activates new HEAD
 */

import { requireHead, ForbiddenError } from "@/lib/auth-utils";
import { transferHead } from "@/lib/membership-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHead();
    const { id } = await params;
    const newHeadId = id;

    // Prevent self-transfer
    if (user.id === newHeadId) {
      throw new ForbiddenError("Cannot transfer HEAD to yourself");
    }

    // Transfer HEAD role
    const result = await transferHead(user.id, newHeadId);
    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "HEAD role transferred successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/admin/members/[id]/transfer-head:", error);
    return Response.json(
      { error: error.message || "Transfer failed" },
      { status: error.statusCode || 500 }
    );
  }
}
