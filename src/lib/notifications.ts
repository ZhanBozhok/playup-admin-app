// Пуши — 09, 13, 17 (Flow 12), 20. Сегменты, шаблоны, отправка в Telegram, история.
import { prisma } from "./db";

const DAY = 86400000;

export class NotifyError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export const TARGET_TYPES = [
  "all_users",
  "event_participants",
  "event_attended",
  "event_no_show",
  "new_users",
  "active_users",
  "sleeping_users",
  "activity_type",
  "traffic_source",
];

export type TargetFilter = { event_id?: string; activity_type?: string; traffic_source?: string };

type Recipient = { id: string; telegramId: string | null; telegramUsername: string | null; displayName: string | null };

// Резолв получателей по сегменту (20).
export async function resolveRecipients(targetType: string, filter: TargetFilter): Promise<Recipient[]> {
  const now = new Date();
  const include = { profile: { select: { displayName: true } } } as const;
  const map = (u: { id: string; telegramId: string | null; telegramUsername: string | null; profile: { displayName: string | null } | null }): Recipient => ({
    id: u.id,
    telegramId: u.telegramId,
    telegramUsername: u.telegramUsername,
    displayName: u.profile?.displayName ?? null,
  });

  async function usersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const users = await prisma.user.findMany({ where: { id: { in: ids }, status: { not: "blocked" } }, include });
    return users.map(map);
  }

  switch (targetType) {
    case "all_users": {
      const users = await prisma.user.findMany({ where: { status: { not: "blocked" } }, include });
      return users.map(map);
    }
    case "event_participants": {
      if (!filter.event_id) throw new NotifyError("VALIDATION_ERROR", "event_id required");
      const b = await prisma.booking.findMany({ where: { eventId: filter.event_id, status: "booked" }, select: { userId: true } });
      return usersByIds(b.map((x) => x.userId));
    }
    case "event_attended": {
      if (!filter.event_id) throw new NotifyError("VALIDATION_ERROR", "event_id required");
      const a = await prisma.attendance.findMany({ where: { eventId: filter.event_id, status: "attended" }, select: { userId: true } });
      return usersByIds(a.map((x) => x.userId));
    }
    case "event_no_show": {
      if (!filter.event_id) throw new NotifyError("VALIDATION_ERROR", "event_id required");
      const a = await prisma.attendance.findMany({ where: { eventId: filter.event_id, status: "no_show" }, select: { userId: true } });
      return usersByIds(a.map((x) => x.userId));
    }
    case "new_users": {
      const users = await prisma.user.findMany({ where: { status: { not: "blocked" }, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } }, include });
      return users.map(map);
    }
    case "active_users": {
      const a = await prisma.attendance.findMany({
        where: { status: "attended", event: { startsAt: { gte: new Date(now.getTime() - 30 * DAY) } } },
        select: { userId: true },
      });
      return usersByIds([...new Set(a.map((x) => x.userId))]);
    }
    case "sleeping_users": {
      const attended = await prisma.attendance.findMany({
        where: { status: "attended" },
        select: { userId: true, event: { select: { startsAt: true } } },
      });
      const lastByUser = new Map<string, number>();
      for (const a of attended) {
        const t = a.event.startsAt.getTime();
        lastByUser.set(a.userId, Math.max(lastByUser.get(a.userId) ?? 0, t));
      }
      const sleeping = [...lastByUser.entries()].filter(([, t]) => t < now.getTime() - 30 * DAY).map(([id]) => id);
      return usersByIds(sleeping);
    }
    case "activity_type": {
      if (!filter.activity_type) throw new NotifyError("VALIDATION_ERROR", "activity_type required");
      const users = await prisma.user.findMany({
        where: { status: { not: "blocked" }, profile: { preferredSports: { has: filter.activity_type } } },
        include,
      });
      return users.map(map);
    }
    case "traffic_source": {
      if (!filter.traffic_source) throw new NotifyError("VALIDATION_ERROR", "traffic_source required");
      const users = await prisma.user.findMany({
        where: { status: { not: "blocked" }, profile: { trafficSource: filter.traffic_source } },
        include,
      });
      return users.map(map);
    }
    default:
      throw new NotifyError("VALIDATION_ERROR", `Unknown target_type: ${targetType}`);
  }
}

const fmtDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Belgrade" });
const fmtTime = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Belgrade" });

// Шаблоны напоминаний (20).
export const REMINDER_TEMPLATES: Record<string, string> = {
  event_reminder_24h:
    "Привет, {{user_name}}! Напоминаем: завтра {{event_title}}.\n\nВремя: {{event_time}}\nМесто: {{venue_name}}, {{venue_address}}\nСтоимость: {{price}} {{currency}}\n\nЕсли планы изменились, лучше отменить запись заранее.",
  event_reminder_3h:
    "Сегодня {{event_title}} в {{event_time}}.\n\nМесто: {{venue_name}}, {{venue_address}}.\nХост: {{host_name}}.\n\nДо встречи на игре.",
};

type TemplateCtx = Record<string, string>;

export function renderTemplate(text: string, ctx: TemplateCtx): string {
  return text
    .replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function eventContext(eventId: string | null) {
  if (!eventId) return {};
  const e = await prisma.event.findUnique({ where: { id: eventId }, include: { venue: true, host: true } });
  if (!e) return {};
  return {
    event_title: e.title,
    event_date: fmtDate.format(e.startsAt),
    event_time: fmtTime.format(e.startsAt),
    venue_name: e.venue?.name ?? "",
    venue_address: e.venue?.address ?? "",
    host_name: e.host?.name ?? "",
    price: String(Number(e.price)),
    currency: e.currency,
  } as TemplateCtx;
}

// Отправка одному пользователю. Реальная доставка при наличии TELEGRAM_BOT_TOKEN,
// иначе симуляция (доставка зависит от инфраструктуры — 09).
async function sendToTelegram(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: true }; // dev-симуляция
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return data.ok ? { ok: true } : { ok: false, error: data.description };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export type SendInput = {
  type?: string; // manual | event_reminder_24h | event_reminder_3h | ...
  target_type: string;
  target_filter?: TargetFilter;
  title?: string;
  message?: string;
  event_id?: string | null;
  adminId: string;
};

export async function createAndSend(input: SendInput) {
  const type = input.type ?? "manual";
  const filter = input.target_filter ?? (input.event_id ? { event_id: input.event_id } : {});
  const eventId = input.event_id ?? filter.event_id ?? null;

  // Текст: для напоминаний без текста берём шаблон (20)
  let message = input.message?.trim() || (REMINDER_TEMPLATES[type] ?? "");
  if (!message) throw new NotifyError("VALIDATION_ERROR", "Пустое сообщение отправить нельзя");

  // Защита (20): нельзя слать авто-напоминание по отменённому событию
  if (eventId) {
    const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
    if (ev?.status === "cancelled" && type.startsWith("event_reminder")) {
      throw new NotifyError("VALIDATION_ERROR", "Событие отменено — напоминание не отправляется");
    }
  }

  const recipients = await resolveRecipients(input.target_type, filter);
  const ctx = await eventContext(eventId);

  const notification = await prisma.notification.create({
    data: {
      type,
      status: "sending",
      targetType: input.target_type,
      targetFilter: filter as object,
      eventId,
      title: input.title ?? null,
      message,
      createdByAdminId: input.adminId,
    },
  });

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const text = renderTemplate(message, {
      ...ctx,
      user_name: r.displayName ?? r.telegramUsername ?? "",
    });
    let status = "pending";
    let error: string | null = null;
    if (!r.telegramId) {
      status = "failed";
      error = "no telegram id";
    } else {
      const res = await sendToTelegram(r.telegramId, text);
      status = res.ok ? "sent" : "failed";
      error = res.error ?? null;
    }
    if (status === "sent") sent++;
    else failed++;
    await prisma.notificationRecipient.create({
      data: {
        notificationId: notification.id,
        userId: r.id,
        status,
        sentAt: status === "sent" ? new Date() : null,
        failedAt: status === "failed" ? new Date() : null,
        errorMessage: error,
      },
    });
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: failed > 0 && sent === 0 ? "failed" : "sent", sentAt: new Date() },
  });

  return { notification_id: notification.id, recipients: recipients.length, sent, failed };
}

export async function previewRecipients(targetType: string, filter: TargetFilter) {
  const recipients = await resolveRecipients(targetType, filter);
  return {
    count: recipients.length,
    sample: recipients.slice(0, 10).map((r) => r.displayName ?? (r.telegramUsername ? `@${r.telegramUsername}` : "—")),
  };
}

export async function listNotifications() {
  const items = await prisma.notification.findMany({
    include: {
      event: { select: { title: true } },
      _count: { select: { recipients: true } },
      recipients: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return items.map((n) => ({
    id: n.id,
    type: n.type,
    status: n.status,
    target_type: n.targetType,
    event_title: n.event?.title ?? null,
    title: n.title,
    message: n.message,
    recipients: n._count.recipients,
    sent: n.recipients.filter((r) => r.status === "sent").length,
    failed: n.recipients.filter((r) => r.status === "failed").length,
    created_at: n.createdAt.toISOString(),
    sent_at: n.sentAt?.toISOString() ?? null,
  }));
}
