// GET / PATCH /api/admin/events/{id} — 13, 07
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { serializeEventForAdmin } from "@/lib/events";
import { eventFinance } from "@/lib/payments";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { venue: true, host: true },
  });
  if (!event) return errorResponse("NOT_FOUND", "Event not found", 404);
  const bookedCount = await prisma.booking.count({ where: { eventId: event.id, status: "booked" } });
  const finance = await eventFinance(event.id);
  return NextResponse.json({ event: serializeEventForAdmin(event, bookedCount), finance });
}

const PatchEvent = z.object({
  title: z.string().min(1).optional(),
  activity_type: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  venue_id: z.string().uuid().nullable().optional(),
  host_id: z.string().uuid().nullable().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  min_quorum: z.number().int().positive().nullable().optional(),
  level: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = PatchEvent.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid event", 400, body.error.flatten());
  const d = body.data;

  const current = await prisma.event.findUnique({ where: { id: params.id } });
  if (!current) return errorResponse("NOT_FOUND", "Event not found", 404);

  const startsAt = d.starts_at ? new Date(d.starts_at) : current.startsAt;
  const endsAt = d.ends_at ? new Date(d.ends_at) : current.endsAt;
  if (endsAt <= startsAt) return errorResponse("VALIDATION_ERROR", "ends_at must be after starts_at", 400);
  const capacity = d.capacity ?? current.capacity;
  const minQuorum = d.min_quorum !== undefined ? d.min_quorum : current.minQuorum;
  if (minQuorum != null && minQuorum > capacity)
    return errorResponse("VALIDATION_ERROR", "min_quorum must be <= capacity", 400);

  const event = await prisma.event.update({
    where: { id: params.id },
    data: {
      title: d.title,
      activityType: d.activity_type,
      description: d.description,
      startsAt: d.starts_at ? startsAt : undefined,
      endsAt: d.ends_at ? endsAt : undefined,
      venueId: d.venue_id,
      hostId: d.host_id,
      price: d.price,
      currency: d.currency,
      capacity: d.capacity,
      minQuorum: d.min_quorum,
      level: d.level,
      internalNotes: d.internal_notes,
    },
    include: { venue: true, host: true },
  });
  const bookedCount = await prisma.booking.count({ where: { eventId: event.id, status: "booked" } });
  return NextResponse.json({ event: serializeEventForAdmin(event, bookedCount) });
}
