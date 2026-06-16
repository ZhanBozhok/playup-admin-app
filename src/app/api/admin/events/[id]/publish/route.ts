// POST /api/admin/events/{id}/publish — 07, 17 (draft->published), 19 (publish validation)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, errorResponse } from "@/lib/http";
import { canTransition, publishValidationErrors, serializeEventForAdmin } from "@/lib/events";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const event = await prisma.event.findUnique({ where: { id: params.id }, include: { venue: true, host: true } });
  if (!event) return errorResponse("NOT_FOUND", "Event not found", 404);

  if (!canTransition(event.status, "published")) {
    return errorResponse("INVALID_STATUS_TRANSITION", `Cannot publish from '${event.status}'`, 409);
  }
  const missing = publishValidationErrors(event);
  if (missing.length > 0) {
    return errorResponse("VALIDATION_ERROR", "Event is not ready to publish", 400, { missing });
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: "published", publishedAt: new Date() },
    include: { venue: true, host: true },
  });
  return NextResponse.json({ event: serializeEventForAdmin(updated, 0) });
}
