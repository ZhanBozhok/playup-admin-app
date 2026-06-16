// CSV-экспорт — 10, 11, 13. Читаемые колонки; значения экранируются по RFC 4180.
import { prisma } from "./db";

function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(",");
  const body = rows.map((r) => r.map(field).join(",")).join("\n");
  // BOM, чтобы Excel корректно открыл кириллицу
  return "﻿" + head + "\n" + body + "\n";
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");

export async function buildExport(resource: string): Promise<{ filename: string; csv: string } | null> {
  switch (resource) {
    case "users.csv": {
      const users = await prisma.user.findMany({ include: { profile: true }, orderBy: { createdAt: "desc" } });
      const rows = users.map((u) => [
        u.id, u.telegramId, u.telegramUsername, u.profile?.displayName, u.profile?.phone, u.profile?.level,
        u.profile?.preferredSports, u.profile?.preferredArea, u.profile?.trafficSource, u.status,
        iso(u.createdAt), iso(u.lastSeenAt),
      ]);
      return { filename: "users.csv", csv: toCsv(
        ["id","telegram_id","telegram_username","display_name","phone","level","preferred_sports","preferred_area","traffic_source","status","created_at","last_seen_at"], rows) };
    }
    case "events.csv": {
      const events = await prisma.event.findMany({ include: { venue: true, host: true }, orderBy: { startsAt: "desc" } });
      const rows = events.map((e) => [
        e.id, e.title, e.activityType, iso(e.startsAt), iso(e.endsAt), e.venue?.name, e.host?.name,
        Number(e.price), e.currency, e.capacity, e.minQuorum, e.level, e.status,
      ]);
      return { filename: "events.csv", csv: toCsv(
        ["id","title","activity_type","starts_at","ends_at","venue","host","price","currency","capacity","min_quorum","level","status"], rows) };
    }
    case "bookings.csv": {
      const bookings = await prisma.booking.findMany({
        include: { event: { select: { title: true } }, user: { include: { profile: { select: { displayName: true } } } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = bookings.map((b) => [
        b.id, b.event.title, b.user.profile?.displayName ?? b.user.telegramUsername, b.status, b.source,
        iso(b.createdAt), iso(b.cancelledAt),
      ]);
      return { filename: "bookings.csv", csv: toCsv(["id","event","user","status","source","created_at","cancelled_at"], rows) };
    }
    case "attendance.csv": {
      const att = await prisma.attendance.findMany({
        include: { event: { select: { title: true } }, user: { include: { profile: { select: { displayName: true } } } } },
        orderBy: { updatedAt: "desc" },
      });
      const rows = att.map((a) => [
        a.id, a.event.title, a.user.profile?.displayName ?? a.user.telegramUsername, a.status, iso(a.markedAt),
      ]);
      return { filename: "attendance.csv", csv: toCsv(["id","event","user","status","marked_at"], rows) };
    }
    case "payments.csv": {
      const pays = await prisma.payment.findMany({
        include: { event: { select: { title: true } }, user: { include: { profile: { select: { displayName: true } } } }, cashbox: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      });
      const rows = pays.map((p) => [
        p.id, p.event.title, p.user.profile?.displayName ?? p.user.telegramUsername, Number(p.amount), p.currency,
        p.status, p.cashbox?.name, iso(p.paidAt),
      ]);
      return { filename: "payments.csv", csv: toCsv(["id","event","user","amount","currency","status","cashbox","paid_at"], rows) };
    }
    case "transactions.csv": {
      const txs = await prisma.transaction.findMany({
        include: { cashbox: { select: { name: true } }, category: { select: { name: true } }, event: { select: { title: true } }, venue: { select: { name: true } }, host: { select: { name: true } } },
        orderBy: { transactionDate: "desc" },
      });
      const rows = txs.map((t) => [
        t.id, t.type, Number(t.amount), t.currency, t.cashbox?.name, t.category?.name, t.event?.title, t.venue?.name,
        t.host?.name, t.description, t.transactionDate.toISOString().slice(0, 10),
      ]);
      return { filename: "transactions.csv", csv: toCsv(
        ["id","type","amount","currency","cashbox","category","event","venue","host","description","transaction_date"], rows) };
    }
    case "survey_responses.csv": {
      const responses = await prisma.surveyResponse.findMany({
        include: { survey: { select: { question: true } }, event: { select: { title: true } }, user: { include: { profile: { select: { displayName: true } } } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = responses.map((r) => [
        r.id, r.survey.question, r.event?.title, r.user.profile?.displayName ?? r.user.telegramUsername,
        r.answerValue != null ? Number(r.answerValue) : "", r.answerText, iso(r.createdAt),
      ]);
      return { filename: "survey_responses.csv", csv: toCsv(["id","question","event","user","answer_value","answer_text","created_at"], rows) };
    }
    default:
      return null;
  }
}

// Проверки качества данных — 22, 24 (#18 мягкое удаление через статусы).
export async function dataQuality() {
  const dupBooking: { event_id: string; user_id: string; n: bigint }[] = await prisma.$queryRaw`
    SELECT event_id, user_id, COUNT(*) AS n FROM bookings WHERE status = 'booked'
    GROUP BY event_id, user_id HAVING COUNT(*) > 1`;
  const dupTelegram: { telegram_id: string; n: bigint }[] = await prisma.$queryRaw`
    SELECT telegram_id, COUNT(*) AS n FROM users WHERE telegram_id IS NOT NULL
    GROUP BY telegram_id HAVING COUNT(*) > 1`;

  const [paidNoCashbox, publishedNoCapacity, badTimes, incomeZero] = await Promise.all([
    prisma.payment.count({ where: { status: "paid", cashboxId: null } }),
    prisma.event.count({ where: { status: "published", capacity: { lte: 0 } } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM events WHERE ends_at <= starts_at`,
    prisma.transaction.count({ where: { type: "income", amount: 0 } }),
  ]);

  const checks = [
    { check: "Дубли активных записей (event+user)", count: dupBooking.length },
    { check: "Дубли telegram_id", count: dupTelegram.length },
    { check: "Оплата paid без кассы", count: paidNoCashbox },
    { check: "Published событие без вместимости", count: publishedNoCapacity },
    { check: "Событие с ends_at ≤ starts_at", count: Number(badTimes[0]?.n ?? 0) },
    { check: "Income-транзакция с нулевой суммой", count: incomeZero },
  ].map((c) => ({ ...c, ok: c.count === 0 }));

  return { checks, all_ok: checks.every((c) => c.ok) };
}
