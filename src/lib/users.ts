// Метрики и статусы пользователей — 06, 19, 21.
import { prisma } from "./db";

const DAY = 86400000;

// Производный статус (06/19): blocked — вручную; иначе по последнему attended.
export function deriveStatus(storedStatus: string, lastAttendedAt: Date | null, now = new Date()): string {
  if (storedStatus === "blocked") return "blocked";
  if (!lastAttendedAt) return "new";
  return now.getTime() - lastAttendedAt.getTime() <= 30 * DAY ? "active" : "sleeping";
}

// Понедельник ISO-недели в полночь UTC — основа для подсчёта серии недель.
function mondayOf(d: Date): number {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // пн=0
  x.setUTCDate(x.getUTCDate() - day);
  return x.getTime();
}

// Текущая серия недель подряд с посещением (21). Считаем подряд идущие недели,
// заканчивая самой свежей неделей с attended.
export function currentWeekStreak(attendedDates: Date[]): number {
  if (attendedDates.length === 0) return 0;
  const weeks = Array.from(new Set(attendedDates.map((d) => mondayOf(d)))).sort((a, b) => b - a);
  let streak = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i - 1] - weeks[i] === 7 * DAY) streak++;
    else break;
  }
  return streak;
}

// Метрики для списка пользователей — батч-запросами на список id.
export async function listMetrics(userIds: string[]) {
  const result = new Map<
    string,
    { attended: number; no_show: number; total_bookings: number; last_attended_at: Date | null }
  >();
  userIds.forEach((id) => result.set(id, { attended: 0, no_show: 0, total_bookings: 0, last_attended_at: null }));
  if (userIds.length === 0) return result;

  const att = await prisma.attendance.groupBy({
    by: ["userId", "status"],
    where: { userId: { in: userIds }, status: { in: ["attended", "no_show"] } },
    _count: { _all: true },
  });
  for (const r of att) {
    const m = result.get(r.userId)!;
    if (r.status === "attended") m.attended = r._count._all;
    if (r.status === "no_show") m.no_show = r._count._all;
  }

  const bookings = await prisma.booking.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _count: { _all: true },
  });
  for (const r of bookings) result.get(r.userId)!.total_bookings = r._count._all;

  // последнее attended — по времени начала события
  const attended = await prisma.attendance.findMany({
    where: { userId: { in: userIds }, status: "attended" },
    include: { event: { select: { startsAt: true } } },
  });
  for (const a of attended) {
    const m = result.get(a.userId)!;
    const t = a.event.startsAt;
    if (!m.last_attended_at || t > m.last_attended_at) m.last_attended_at = t;
  }

  return result;
}

// Полные метрики карточки пользователя (21).
export async function detailMetrics(userId: string) {
  const [attendedRows, noShow, totalBookings, paidAgg] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, status: "attended" },
      include: { event: { select: { startsAt: true, activityType: true } } },
    }),
    prisma.attendance.count({ where: { userId, status: "no_show" } }),
    prisma.booking.count({ where: { userId } }),
    prisma.payment.aggregate({ where: { userId, status: "paid" }, _sum: { amount: true } }),
  ]);

  const attendedDates = attendedRows.map((a) => a.event.startsAt);
  const lastAttendedAt = attendedDates.length
    ? new Date(Math.max(...attendedDates.map((d) => d.getTime())))
    : null;

  // любимая активность по числу посещений
  const byActivity: Record<string, number> = {};
  for (const a of attendedRows) byActivity[a.event.activityType] = (byActivity[a.event.activityType] ?? 0) + 1;
  const favoriteActivity =
    Object.entries(byActivity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    total_attended: attendedRows.length,
    total_no_show: noShow,
    total_bookings: totalBookings,
    total_paid: Number(paidAgg._sum.amount ?? 0),
    last_attended_at: lastAttendedAt?.toISOString() ?? null,
    current_week_streak: currentWeekStreak(attendedDates),
    favorite_activity: favoriteActivity,
  };
}
