// GET /api/client/events — 13, 07. Только published будущие события, по времени.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeEventForClientList } from "@/lib/events";
import { bookedCountsByEvent, userBookingStatuses } from "@/lib/bookings";
import { optionalClient } from "@/lib/http";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activityType = url.searchParams.get("activity_type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Prisma.EventWhereInput = {
    status: "published",
    endsAt: { gte: from ? new Date(from) : new Date() },
  };
  if (activityType) where.activityType = activityType;
  if (to) where.startsAt = { lte: new Date(to) };

  const events = await prisma.event.findMany({
    where,
    include: { venue: true, host: true },
    orderBy: { startsAt: "asc" },
  });

  const ids = events.map((e) => e.id);
  const counts = await bookedCountsByEvent(ids);
  const userId = optionalClient(req);
  const statuses = userId ? await userBookingStatuses(userId, ids) : {};

  return NextResponse.json({
    events: events.map((e) => serializeEventForClientList(e, counts[e.id] ?? 0, statuses[e.id] ?? null)),
  });
}
