// POST /api/admin/events/{id}/complete — 17 (published -> completed)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, errorResponse } from "@/lib/http";
import { canTransition, serializeEventForAdmin } from "@/lib/events";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return errorResponse("NOT_FOUND", "Event not found", 404);

  if (!canTransition(event.status, "completed")) {
    return errorResponse("INVALID_STATUS_TRANSITION", `Cannot complete from '${event.status}'`, 409);
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: "completed", completedAt: new Date() },
    include: { venue: true, host: true },
  });
  return NextResponse.json({ event: serializeEventForAdmin(updated, 0) });
}
