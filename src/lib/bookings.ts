// Логика записей (07, 13, 17 Flow 3–5, 19). Не смешиваем Booking/Attendance/Payment.
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export class BookingError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export type ProfileInput = {
  display_name?: string;
  level?: string;
  preferred_sports?: string[];
  preferred_area?: string;
  traffic_source?: string;
  phone?: string;
};

// Счётчики активных записей (status='booked') по списку событий.
export async function bookedCountsByEvent(eventIds: string[]): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const rows = await prisma.booking.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: "booked" },
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.eventId] = r._count._all;
  return map;
}

// Статус записи пользователя по событиям: 'booked' если активна, иначе null.
export async function userBookingStatuses(
  userId: string,
  eventIds: string[],
): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {};
  const rows = await prisma.booking.findMany({
    where: { userId, eventId: { in: eventIds }, status: "booked" },
    select: { eventId: true },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.eventId] = "booked";
  return map;
}

function requireProfileFields(input: ProfileInput): string[] {
  // Обязательный минимум первой записи (06/16): имя, уровень, источник.
  const missing: string[] = [];
  if (!input.display_name?.trim()) missing.push("display_name");
  if (!input.level?.trim()) missing.push("level");
  if (!input.traffic_source?.trim()) missing.push("traffic_source");
  return missing;
}

/**
 * Создаёт запись (17 Flow 3): валидация события и профиля, затем в транзакции —
 * Booking(booked) + Attendance(unknown) + Payment(unpaid). Возвращает booking и event-срез.
 */
export async function createBooking(
  userId: string,
  eventId: string,
  profile?: ProfileInput,
  opts: { requireProfile?: boolean } = {},
) {
  const requireProfile = opts.requireProfile ?? true;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new BookingError("NOT_FOUND", "Event not found", 404);
  if (event.status === "cancelled") throw new BookingError("EVENT_CANCELLED", "Event is cancelled", 409);
  if (event.status !== "published") throw new BookingError("EVENT_NOT_PUBLISHED", "Event is not published", 409);
  if (event.startsAt <= new Date()) throw new BookingError("EVENT_ALREADY_STARTED", "Event already started", 409);

  // Профиль (06/16): если не заполнен и данные не переданы — PROFILE_REQUIRED.
  // Админ при ручном добавлении может пропустить (requireProfile=false).
  const existingProfile = await prisma.userProfile.findUnique({ where: { userId } });
  const profileCompleted = Boolean(existingProfile?.profileCompletedAt);
  if (requireProfile && !profileCompleted) {
    if (!profile) throw new BookingError("PROFILE_REQUIRED", "Profile completion required", 400);
    const missing = requireProfileFields(profile);
    if (missing.length > 0) throw new BookingError("PROFILE_REQUIRED", "Profile fields required", 400);
  }

  return prisma.$transaction(async (tx) => {
    // Профиль апдейтим внутри транзакции, если переданы данные.
    if (profile && (profile.display_name || profile.level || profile.traffic_source)) {
      await tx.userProfile.upsert({
        where: { userId },
        update: {
          displayName: profile.display_name,
          level: profile.level,
          preferredSports: profile.preferred_sports,
          preferredArea: profile.preferred_area,
          phone: profile.phone,
          // traffic_source при первом заполнении; не переписываем, если уже есть
          trafficSource: existingProfile?.trafficSource ?? profile.traffic_source,
          profileCompletedAt: existingProfile?.profileCompletedAt ?? new Date(),
        },
        create: {
          userId,
          displayName: profile.display_name,
          level: profile.level,
          preferredSports: profile.preferred_sports ?? [],
          preferredArea: profile.preferred_area,
          phone: profile.phone,
          trafficSource: profile.traffic_source,
          profileCompletedAt: new Date(),
        },
      });
    }

    // Уже записан?
    const active = await tx.booking.findFirst({ where: { eventId, userId, status: "booked" } });
    if (active) throw new BookingError("ALREADY_BOOKED", "Already booked", 409);

    // Места: активные записи < вместимости.
    const bookedCount = await tx.booking.count({ where: { eventId, status: "booked" } });
    if (bookedCount >= event.capacity) throw new BookingError("EVENT_FULL", "No spots left", 409);

    const booking = await tx.booking.create({
      data: { eventId, userId, status: "booked", source: "client_app" },
    });

    // Attendance(unknown) и Payment(unpaid) — unique(event,user), поэтому upsert
    // (на случай повторной записи после отмены).
    await tx.attendance.upsert({
      where: { uniq_attendance_event_user: { eventId, userId } },
      update: { status: "unknown", bookingId: booking.id },
      create: { eventId, userId, bookingId: booking.id, status: "unknown" },
    });
    await tx.payment.upsert({
      where: { uniq_payment_event_user: { eventId, userId } },
      update: { status: "unpaid", bookingId: booking.id, amount: event.price, currency: event.currency },
      create: {
        eventId,
        userId,
        bookingId: booking.id,
        status: "unpaid",
        amount: event.price,
        currency: event.currency,
      },
    });

    const newCount = bookedCount + 1;
    return {
      booking,
      spotsLeft: Math.max(0, event.capacity - newCount),
    };
  });
}

/** Отмена записи пользователем (17 Flow 5). Booking->cancelled, Attendance->cancelled_before_event. */
export async function cancelBooking(userId: string, bookingId: string, reason?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.userId !== userId) throw new BookingError("BOOKING_NOT_FOUND", "Booking not found", 404);
  if (booking.status !== "booked") throw new BookingError("BOOKING_NOT_FOUND", "Booking is not active", 409);

  const event = await prisma.event.findUnique({ where: { id: booking.eventId } });
  if (event && event.startsAt <= new Date())
    throw new BookingError("EVENT_ALREADY_STARTED", "Event already started", 409);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason ?? null },
    });
    await tx.attendance.updateMany({
      where: { eventId: booking.eventId, userId },
      data: { status: "cancelled_before_event" },
    });
    // Payment не трогаем: возврат — ручное действие админа (17 Flow 5).
    return updated;
  });
}

export type EventForSerialize = Prisma.EventGetPayload<{ include: { venue: true; host: true } }>;
