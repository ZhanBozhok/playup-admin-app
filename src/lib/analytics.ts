// Аналитика — 11, 21. Все метрики по серверным данным; revenue только из transactions.
import { prisma } from "./db";
import { deriveStatus } from "./users";

const DAY = 86400000;

function mondayKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

export async function getAnalytics(fromStr?: string, toStr?: string) {
  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getTime() - 90 * DAY);
  const to = toStr ? new Date(toStr) : now;

  // События периода (по startsAt)
  const events = await prisma.event.findMany({
    where: { startsAt: { gte: from, lte: to } },
    include: { venue: { select: { name: true } }, host: { select: { id: true, name: true } } },
  });
  const ids = events.map((e) => e.id);

  const [bookings, attendance, txs, payments] = await Promise.all([
    prisma.booking.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, status: true } }),
    prisma.attendance.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, status: true } }),
    prisma.transaction.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, type: true, amount: true } }),
    prisma.payment.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, status: true } }),
  ]);

  const bookedByEvent = new Map<string, number>();
  for (const b of bookings) if (b.status === "booked") bookedByEvent.set(b.eventId, (bookedByEvent.get(b.eventId) ?? 0) + 1);
  const attByEvent = new Map<string, { attended: number; no_show: number }>();
  for (const a of attendance) {
    const m = attByEvent.get(a.eventId) ?? { attended: 0, no_show: 0 };
    if (a.status === "attended") m.attended++;
    if (a.status === "no_show") m.no_show++;
    attByEvent.set(a.eventId, m);
  }
  const incomeByEvent = new Map<string, number>();
  const expenseByEvent = new Map<string, number>();
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.type === "income") incomeByEvent.set(t.eventId!, (incomeByEvent.get(t.eventId!) ?? 0) + amt);
    if (t.type === "expense") expenseByEvent.set(t.eventId!, (expenseByEvent.get(t.eventId!) ?? 0) + amt);
  }

  // Totals
  let totBooked = 0, totAttended = 0, totNoShow = 0, totRevenue = 0, totExpenses = 0, totCapacity = 0;
  const paidCount = payments.filter((p) => p.status === "paid").length;
  for (const e of events) {
    totBooked += bookedByEvent.get(e.id) ?? 0;
    const a = attByEvent.get(e.id) ?? { attended: 0, no_show: 0 };
    totAttended += a.attended;
    totNoShow += a.no_show;
    totRevenue += incomeByEvent.get(e.id) ?? 0;
    totExpenses += expenseByEvent.get(e.id) ?? 0;
    totCapacity += e.capacity;
  }

  const overview = {
    events: events.length,
    published: events.filter((e) => e.status === "published").length,
    cancelled: events.filter((e) => e.status === "cancelled").length,
    completed: events.filter((e) => e.status === "completed").length,
    bookings: totBooked,
    attended: totAttended,
    no_show: totNoShow,
    attendance_rate: totBooked ? Math.round((totAttended / totBooked) * 100) / 100 : 0,
    no_show_rate: totBooked ? Math.round((totNoShow / totBooked) * 100) / 100 : 0,
    payment_rate: totBooked ? Math.round((paidCount / totBooked) * 100) / 100 : 0,
    fill_rate: totCapacity ? Math.round((totBooked / totCapacity) * 100) / 100 : 0,
    revenue: totRevenue,
    expenses: totExpenses,
    profit: totRevenue - totExpenses,
    avg_check: paidCount ? Math.round(totRevenue / paidCount) : 0,
  };

  // События по неделям
  const weekMap = new Map<string, number>();
  for (const e of events) weekMap.set(mondayKey(e.startsAt), (weekMap.get(mondayKey(e.startsAt)) ?? 0) + 1);
  const events_per_week = [...weekMap.entries()].sort().map(([week, count]) => ({ week, count }));

  // Разрез по активности
  const actMap = new Map<string, { events: number; attended: number; revenue: number; profit: number; booked: number; capacity: number }>();
  for (const e of events) {
    const m = actMap.get(e.activityType) ?? { events: 0, attended: 0, revenue: 0, profit: 0, booked: 0, capacity: 0 };
    m.events++;
    m.attended += attByEvent.get(e.id)?.attended ?? 0;
    m.revenue += incomeByEvent.get(e.id) ?? 0;
    m.profit += (incomeByEvent.get(e.id) ?? 0) - (expenseByEvent.get(e.id) ?? 0);
    m.booked += bookedByEvent.get(e.id) ?? 0;
    m.capacity += e.capacity;
    actMap.set(e.activityType, m);
  }
  const by_activity = [...actMap.entries()].map(([activity_type, m]) => ({
    activity_type,
    events: m.events,
    attended: m.attended,
    revenue: m.revenue,
    profit: m.profit,
    fill_rate: m.capacity ? Math.round((m.booked / m.capacity) * 100) / 100 : 0,
  }));

  // Разрез по площадке
  const venueMap = new Map<string, { events: number; revenue: number; expenses: number }>();
  for (const e of events) {
    const name = e.venue?.name ?? "—";
    const m = venueMap.get(name) ?? { events: 0, revenue: 0, expenses: 0 };
    m.events++;
    m.revenue += incomeByEvent.get(e.id) ?? 0;
    m.expenses += expenseByEvent.get(e.id) ?? 0;
    venueMap.set(name, m);
  }
  const by_venue = [...venueMap.entries()].map(([venue, m]) => ({
    venue,
    events: m.events,
    revenue: m.revenue,
    expenses: m.expenses,
    profit: m.revenue - m.expenses,
  }));

  // Разрез по хосту (+ средняя оценка из опросов событий хоста за период)
  const hostSurvey = await prisma.surveyResponse.findMany({
    where: { event: { hostId: { not: null }, startsAt: { gte: from, lte: to } }, answerValue: { not: null } },
    select: { answerValue: true, event: { select: { hostId: true } } },
  });
  const hostRating = new Map<string, { sum: number; n: number }>();
  for (const r of hostSurvey) {
    const hid = r.event?.hostId;
    if (!hid) continue;
    const m = hostRating.get(hid) ?? { sum: 0, n: 0 };
    m.sum += Number(r.answerValue); m.n++;
    hostRating.set(hid, m);
  }
  const hostMap = new Map<string, { name: string; events: number; attended: number }>();
  for (const e of events) {
    if (!e.host) continue;
    const m = hostMap.get(e.host.id) ?? { name: e.host.name, events: 0, attended: 0 };
    m.events++;
    m.attended += attByEvent.get(e.id)?.attended ?? 0;
    hostMap.set(e.host.id, m);
  }
  const by_host = [...hostMap.entries()].map(([hid, m]) => {
    const r = hostRating.get(hid);
    return { host: m.name, events: m.events, attended: m.attended, avg_rating: r ? Math.round((r.sum / r.n) * 100) / 100 : null };
  });

  // Пользователи: статусы и источники; retention (по всем данным)
  const users = await prisma.user.findMany({ include: { profile: { select: { trafficSource: true } } } });
  const attendedAll = await prisma.attendance.findMany({
    where: { status: "attended" },
    select: { userId: true, event: { select: { startsAt: true } } },
  });
  const attendedCount = new Map<string, number>();
  const firstAttended = new Map<string, Date>();
  for (const a of attendedAll) {
    attendedCount.set(a.userId, (attendedCount.get(a.userId) ?? 0) + 1);
    const cur = firstAttended.get(a.userId);
    if (!cur || a.event.startsAt < cur) firstAttended.set(a.userId, a.event.startsAt);
  }
  const lastAttended = new Map<string, Date>();
  for (const a of attendedAll) {
    const cur = lastAttended.get(a.userId);
    if (!cur || a.event.startsAt > cur) lastAttended.set(a.userId, a.event.startsAt);
  }

  const statusCounts = { new: 0, active: 0, sleeping: 0, blocked: 0 } as Record<string, number>;
  for (const u of users) {
    const st = deriveStatus(u.status, lastAttended.get(u.id) ?? null, now);
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
  }

  const sourceMap = new Map<string, { users: number; first_attendees: number }>();
  for (const u of users) {
    const src = u.profile?.trafficSource ?? "—";
    const m = sourceMap.get(src) ?? { users: 0, first_attendees: 0 };
    m.users++;
    if (firstAttended.has(u.id)) m.first_attendees++;
    sourceMap.set(src, m);
  }
  const by_source = [...sourceMap.entries()].map(([source, m]) => ({ source, users: m.users, first_attendees: m.first_attendees }));

  const usersWith1 = [...attendedCount.values()].filter((n) => n >= 1).length;
  const usersWith2 = [...attendedCount.values()].filter((n) => n >= 2).length;
  const usersWith3 = [...attendedCount.values()].filter((n) => n >= 3).length;
  const weeklyActive = new Set(attendedAll.filter((a) => a.event.startsAt >= new Date(now.getTime() - 7 * DAY)).map((a) => a.userId)).size;

  const retention = {
    first_visit_users: usersWith1,
    second_visit_rate: usersWith1 ? Math.round((usersWith2 / usersWith1) * 100) / 100 : 0,
    third_visit_rate: usersWith1 ? Math.round((usersWith3 / usersWith1) * 100) / 100 : 0,
    weekly_active_attendees: weeklyActive,
  };

  // Новые пользователи периода
  const newUsers = users.filter((u) => u.createdAt >= from && u.createdAt <= to).length;

  return {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    overview: { ...overview, new_users: newUsers },
    events_per_week,
    by_activity,
    by_venue,
    by_host,
    by_source,
    users_by_status: statusCounts,
    retention,
  };
}
