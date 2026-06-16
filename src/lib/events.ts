// Бизнес-логика событий: сериализация, risk status (19), валидация публикации (07/19),
// проверка переходов статуса (17 state machine).
import type { Prisma } from "@prisma/client";

export type EventWithRels = Prisma.EventGetPayload<{
  include: { venue: true; host: true };
}>;

// Активные записи появятся в Итерации 2; пока booked_count = 0.
export function spotsLeft(capacity: number, bookedCount: number): number {
  return Math.max(0, capacity - bookedCount);
}

// Risk status — 19_enums_statuses_business_rules.md
export function riskStatus(e: {
  status: string;
  capacity: number;
  minQuorum: number | null;
  endsAt: Date;
}, bookedCount: number, now = new Date()): string {
  if (e.status !== "completed" && e.status !== "cancelled" && e.endsAt < now) {
    return "needs_closing";
  }
  const left = spotsLeft(e.capacity, bookedCount);
  if (left === 0) return "full";
  if (left <= 2) return "almost_full";
  if (e.minQuorum != null && bookedCount < e.minQuorum) return "below_quorum";
  return "ok";
}

export function serializeEventForAdmin(e: EventWithRels, bookedCount = 0) {
  return {
    id: e.id,
    title: e.title,
    activity_type: e.activityType,
    description: e.description,
    starts_at: e.startsAt.toISOString(),
    ends_at: e.endsAt.toISOString(),
    venue: e.venue ? { id: e.venue.id, name: e.venue.name, address: e.venue.address } : null,
    host: e.host ? { id: e.host.id, name: e.host.name } : null,
    price: Number(e.price),
    currency: e.currency,
    capacity: e.capacity,
    min_quorum: e.minQuorum,
    level: e.level,
    status: e.status,
    booked_count: bookedCount,
    spots_left: spotsLeft(e.capacity, bookedCount),
    risk_status: riskStatus(e, bookedCount),
    published_at: e.publishedAt?.toISOString() ?? null,
    cancelled_at: e.cancelledAt?.toISOString() ?? null,
    completed_at: e.completedAt?.toISOString() ?? null,
  };
}

export function serializeEventForClientList(e: EventWithRels, bookedCount = 0, userBookingStatus: string | null = null) {
  return {
    id: e.id,
    title: e.title,
    activity_type: e.activityType,
    starts_at: e.startsAt.toISOString(),
    ends_at: e.endsAt.toISOString(),
    venue: e.venue ? { id: e.venue.id, name: e.venue.name, address: e.venue.address } : null,
    price: Number(e.price),
    currency: e.currency,
    capacity: e.capacity,
    booked_count: bookedCount,
    spots_left: spotsLeft(e.capacity, bookedCount),
    level: e.level,
    status: e.status,
    user_booking_status: userBookingStatus,
  };
}

export function serializeEventForClientDetail(
  e: EventWithRels,
  bookedCount = 0,
  userBookingStatus: string | null = null,
  requiresProfileCompletion = true,
) {
  return {
    ...serializeEventForClientList(e, bookedCount, userBookingStatus),
    description: e.description,
    venue: e.venue
      ? { id: e.venue.id, name: e.venue.name, address: e.venue.address, map_url: e.venue.mapUrl }
      : null,
    host: e.host ? { name: e.host.name } : null,
    min_quorum: e.minQuorum,
    requires_profile_completion: requiresProfileCompletion,
  };
}

// Обязательные поля для публикации — 07 + 19.
export function publishValidationErrors(e: EventWithRels): string[] {
  const errors: string[] = [];
  if (!e.title?.trim()) errors.push("title");
  if (!e.activityType?.trim()) errors.push("activity_type");
  if (!e.startsAt) errors.push("starts_at");
  if (!e.endsAt) errors.push("ends_at");
  if (!e.venueId) errors.push("venue_id");
  if (!e.description?.trim()) errors.push("description");
  if (e.price == null) errors.push("price");
  if (!e.currency) errors.push("currency");
  if (e.capacity == null) errors.push("capacity");
  if (e.minQuorum == null) errors.push("min_quorum");
  if (e.startsAt && e.endsAt && e.endsAt <= e.startsAt) errors.push("ends_at_after_starts_at");
  if (e.minQuorum != null && e.capacity != null && e.minQuorum > e.capacity) errors.push("min_quorum_le_capacity");
  return errors;
}

// Разрешённые переходы статуса — 17 state machine (без ручных коррекций).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["published", "cancelled"],
  published: ["cancelled", "completed"],
  cancelled: [],
  completed: [],
};

export function canTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
