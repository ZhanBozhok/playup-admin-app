// GET (list) / POST (create) /api/admin/events — 13, 07, 19
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { serializeEventForAdmin } from "@/lib/events";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const where: Prisma.EventWhereInput = {};
  const status = url.searchParams.get("status");
  const activityType = url.searchParams.get("activity_type");
  const venueId = url.searchParams.get("venue_id");
  const hostId = url.searchParams.get("host_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (status) where.status = status;
  if (activityType) where.activityType = activityType;
  if (venueId) where.venueId = venueId;
  if (hostId) where.hostId = hostId;
  if (from || to) {
    where.startsAt = {};
    if (from) where.startsAt.gte = new Date(from);
    if (to) where.startsAt.lte = new Date(to);
  }

  const events = await prisma.event.findMany({
    where,
    include: { venue: true, host: true },
    orderBy: { startsAt: "asc" },
  });
  // booked_count появится в Итерации 2; пока 0.
  return NextResponse.json({ events: events.map((e) => serializeEventForAdmin(e, 0)) });
}

const CreateEvent = z.object({
  title: z.string().min(1),
  activity_type: z.string().min(1),
  description: z.string().optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  venue_id: z.string().uuid().nullable().optional(),
  host_id: z.string().uuid().nullable().optional(),
  price: z.number().nonnegative().default(0),
  currency: z.string().default("RSD"),
  capacity: z.number().int().positive(),
  min_quorum: z.number().int().positive().nullable().optional(),
  level: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = CreateEvent.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid event", 400, body.error.flatten());
  const d = body.data;

  const startsAt = new Date(d.starts_at);
  const endsAt = new Date(d.ends_at);
  if (endsAt <= startsAt) return errorResponse("VALIDATION_ERROR", "ends_at must be after starts_at", 400);
  if (d.min_quorum != null && d.min_quorum > d.capacity)
    return errorResponse("VALIDATION_ERROR", "min_quorum must be <= capacity", 400);

  // Событие всегда создаётся как draft (07); публикация — отдельным эндпоинтом.
  const event = await prisma.event.create({
    data: {
      title: d.title,
      activityType: d.activity_type,
      description: d.description,
      startsAt,
      endsAt,
      venueId: d.venue_id ?? null,
      hostId: d.host_id ?? null,
      price: d.price,
      currency: d.currency,
      capacity: d.capacity,
      minQuorum: d.min_quorum ?? null,
      level: d.level ?? null,
      status: "draft",
      createdByAdminId: auth.sub,
    },
    include: { venue: true, host: true },
  });
  return NextResponse.json({ event: serializeEventForAdmin(event, 0) }, { status: 201 });
}
