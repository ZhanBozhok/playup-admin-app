// GET /api/client/home — 13. Ближайшие записи пользователя + пара открытых событий.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/http";

export async function GET(req: Request) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { profile: true },
  });
  if (!user) return NextResponse.json({ error: { code: "NOT_FOUND", message: "User" } }, { status: 404 });

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: { userId: auth.userId, status: "booked", event: { endsAt: { gte: now }, status: "published" } },
    include: { event: { include: { venue: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });

  const upcoming = bookings.map((b) => ({
    booking_id: b.id,
    booking_status: b.status,
    event: {
      id: b.event.id,
      title: b.event.title,
      activity_type: b.event.activityType,
      starts_at: b.event.startsAt.toISOString(),
      ends_at: b.event.endsAt.toISOString(),
      venue_name: b.event.venue?.name ?? null,
      status: b.event.status,
    },
  }));

  // пара ближайших открытых событий, куда пользователь ещё не записан
  const bookedEventIds = bookings.map((b) => b.event.id);
  const suggested = await prisma.event.findMany({
    where: { status: "published", endsAt: { gte: now }, id: { notIn: bookedEventIds } },
    include: { venue: true },
    orderBy: { startsAt: "asc" },
    take: 2,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      display_name: user.profile?.displayName ?? null,
      profile_completed: Boolean(user.profile?.profileCompletedAt),
    },
    upcoming_bookings: upcoming,
    suggested_events: suggested.map((e) => ({
      id: e.id,
      title: e.title,
      activity_type: e.activityType,
      starts_at: e.startsAt.toISOString(),
      venue_name: e.venue?.name ?? null,
    })),
  });
}
