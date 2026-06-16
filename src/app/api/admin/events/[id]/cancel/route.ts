// POST /api/admin/events/{id}/cancel — 17 (draft|published -> cancelled)
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { canTransition, serializeEventForAdmin } from "@/lib/events";

const Body = z.object({ reason: z.string().optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = Body.safeParse((await parseJson(req)) ?? {});
  const reason = body.success ? body.data.reason : undefined;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return errorResponse("NOT_FOUND", "Event not found", 404);

  if (!canTransition(event.status, "cancelled")) {
    return errorResponse("INVALID_STATUS_TRANSITION", `Cannot cancel from '${event.status}'`, 409);
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: reason ?? null },
    include: { venue: true, host: true },
  });
  return NextResponse.json({ event: serializeEventForAdmin(updated, 0) });
}
