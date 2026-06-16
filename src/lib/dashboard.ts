// Управленческая Главная — 11, 13, 19 (risk), 21 (метрики). Оперативный экран.
import { prisma } from "./db";
import { riskStatus } from "./events";
import { bookedCountsByEvent } from "./bookings";
import { financeSummary } from "./finance";

const DAY = 86400000;

export async function getDashboard() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Published-события: ближайшие (endsAt>=now) + прошедшие незакрытые (needs_closing)
  const events = await prisma.event.findMany({
    where: { status: "published" },
    include: { venue: true, host: true },
    orderBy: { startsAt: "asc" },
  });
  const ids = events.map((e) => e.id);
  const booked = await bookedCountsByEvent(ids);

  // По релевантным событиям — неоплаченные активные и неотмеченная явка
  const [unpaidActive, attendanceRows] = await Promise.all([
    prisma.payment.findMany({
      where: { eventId: { in: ids }, status: "unpaid", booking: { status: "booked" } },
      select: { eventId: true },
    }),
    prisma.attendance.findMany({
      where: { eventId: { in: ids } },
      select: { eventId: true, status: true },
    }),
  ]);
  const unpaidByEvent = new Map<string, number>();
  for (const p of unpaidActive) unpaidByEvent.set(p.eventId, (unpaidByEvent.get(p.eventId) ?? 0) + 1);
  const unknownAttByEvent = new Map<string, number>();
  for (const a of attendanceRows) if (a.status === "unknown") unknownAttByEvent.set(a.eventId, (unknownAttByEvent.get(a.eventId) ?? 0) + 1);

  // все published (completed/cancelled уже отфильтрованы запросом)
  const upcoming = events
    .map((e) => {
      const bc = booked[e.id] ?? 0;
      return {
        id: e.id,
        title: e.title,
        starts_at: e.startsAt.toISOString(),
        venue_name: e.venue?.name ?? null,
        host_name: e.host?.name ?? null,
        capacity: e.capacity,
        booked_count: bc,
        min_quorum: e.minQuorum,
        risk_status: riskStatus(e, bc, now),
        expected_revenue: bc * Number(e.price),
        ended: e.endsAt < now,
      };
    });

  // Блок действий (11)
  const actions: { type: string; event_id: string; label: string }[] = [];
  for (const e of upcoming) {
    if (e.ended) {
      actions.push({ type: "complete_event", event_id: e.id, label: `Закрыть событие: ${e.title}` });
      if ((unknownAttByEvent.get(e.id) ?? 0) > 0)
        actions.push({ type: "mark_attendance", event_id: e.id, label: `Отметить явку: ${e.title}` });
    } else if (e.min_quorum != null && e.booked_count < e.min_quorum) {
      actions.push({ type: "below_quorum", event_id: e.id, label: `Ниже кворума: ${e.title}` });
    }
    if ((unpaidByEvent.get(e.id) ?? 0) > 0)
      actions.push({ type: "unpaid_participants", event_id: e.id, label: `Есть неоплаченные: ${e.title}` });
  }

  // Метрики недели (21)
  const [incomeWeek, expenseWeek, incomeToday, newUsersWeek] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: "income", transactionDate: { gte: weekAgo } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "expense", transactionDate: { gte: weekAgo } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "income", transactionDate: { gte: todayStart } }, _sum: { amount: true } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  // Посещаемость: attended-история (для first/repeat/active/no-show недели)
  const attended = await prisma.attendance.findMany({
    where: { status: "attended" },
    include: { event: { select: { startsAt: true } } },
  });
  const firstByUser = new Map<string, Date>();
  const countByUser = new Map<string, number>();
  for (const a of attended) {
    const t = a.event.startsAt;
    countByUser.set(a.userId, (countByUser.get(a.userId) ?? 0) + 1);
    const cur = firstByUser.get(a.userId);
    if (!cur || t < cur) firstByUser.set(a.userId, t);
  }
  let firstTimeWeek = 0;
  const attendedThisWeekUsers = new Set<string>();
  const active30Set = new Set<string>();
  for (const first of firstByUser.values()) if (first >= weekAgo && first <= now) firstTimeWeek++;
  for (const a of attended) {
    if (a.event.startsAt >= weekAgo) attendedThisWeekUsers.add(a.userId);
    if (a.event.startsAt >= monthAgo) active30Set.add(a.userId);
  }
  let repeatWeek = 0;
  for (const uid of attendedThisWeekUsers) if ((countByUser.get(uid) ?? 0) >= 2) repeatWeek++;

  // no-show rate недели: по событиям, прошедшим за 7 дней
  const weekAtt = await prisma.attendance.findMany({
    where: { event: { startsAt: { gte: weekAgo, lte: now } } },
    select: { status: true },
  });
  const att = weekAtt.filter((a) => a.status === "attended").length;
  const ns = weekAtt.filter((a) => a.status === "no_show").length;
  const noShowRateWeek = att + ns > 0 ? ns / (att + ns) : 0;

  const fin = await financeSummary(); // балансы касс + неоплачено (всё время)

  return {
    upcoming_events: upcoming.map(({ ended, ...rest }) => ({ ...rest, needs_closing: ended })),
    actions,
    metrics: {
      revenue_today: Number(incomeToday._sum.amount ?? 0),
      revenue_week: Number(incomeWeek._sum.amount ?? 0),
      expenses_week: Number(expenseWeek._sum.amount ?? 0),
      profit_week: Number(incomeWeek._sum.amount ?? 0) - Number(expenseWeek._sum.amount ?? 0),
      new_users_week: newUsersWeek,
      first_time_attendees_week: firstTimeWeek,
      repeat_attendees_week: repeatWeek,
      active_users_30d: active30Set.size,
      no_show_rate_week: Math.round(noShowRateWeek * 100) / 100,
      unpaid_amount: fin.unpaid_amount,
    },
    cashboxes: fin.cashboxes,
  };
}
