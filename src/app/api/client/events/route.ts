// GET /api/client/events — 13, 07. Только published будущие события, по времени.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeEventForClientList } from "@/lib/events";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activityType = url.searchParams.get("activity_type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Клиент видит только published и ещё не завершённые (endsAt в будущем).
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

  // booked_count и user_booking_status появятся в Итерации 2.
  return NextResponse.json({ events: events.map((e) => serializeEventForClientList(e, 0, null)) });
}
