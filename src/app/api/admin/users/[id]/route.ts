// GET /api/admin/users/{id} — 13, 15. Профиль, метрики, история записей и оплат.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, errorResponse } from "@/lib/http";
import { detailMetrics, deriveStatus } from "@/lib/users";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({ where: { id: params.id }, include: { profile: true } });
  if (!user) return errorResponse("NOT_FOUND", "User not found", 404);

  const metrics = await detailMetrics(user.id);

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    include: { event: { select: { id: true, title: true, activityType: true, startsAt: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  // явка и оплаты по событиям пользователя
  const [attendance, payments, notes] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: user.id } }),
    prisma.payment.findMany({ where: { userId: user.id }, include: { event: { select: { title: true } } } }),
    prisma.adminNote.findMany({
      where: { entityType: "user", entityId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const attByEvent = new Map(attendance.map((a) => [a.eventId, a.status]));

  return NextResponse.json({
    user: {
      id: user.id,
      telegram_id: user.telegramId,
      telegram_username: user.telegramUsername,
      status: deriveStatus(user.status, metrics.last_attended_at ? new Date(metrics.last_attended_at) : null),
      stored_status: user.status,
      created_at: user.createdAt.toISOString(),
      last_seen_at: user.lastSeenAt?.toISOString() ?? null,
      profile: user.profile
        ? {
            display_name: user.profile.displayName,
            phone: user.profile.phone,
            level: user.profile.level,
            preferred_sports: user.profile.preferredSports,
            preferred_area: user.profile.preferredArea,
            available_times: user.profile.availableTimes,
            traffic_source: user.profile.trafficSource,
            profile_completed: Boolean(user.profile.profileCompletedAt),
          }
        : null,
    },
    metrics,
    bookings: bookings.map((b) => ({
      booking_id: b.id,
      booking_status: b.status,
      attendance_status: attByEvent.get(b.eventId) ?? "unknown",
      created_at: b.createdAt.toISOString(),
      event: {
        id: b.event.id,
        title: b.event.title,
        activity_type: b.event.activityType,
        starts_at: b.event.startsAt.toISOString(),
        status: b.event.status,
      },
    })),
    payments: payments.map((p) => ({
      id: p.id,
      event_title: p.event?.title ?? null,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paid_at: p.paidAt?.toISOString() ?? null,
    })),
    notes: notes.map((n) => ({ id: n.id, note: n.note, created_at: n.createdAt.toISOString() })),
  });
}
