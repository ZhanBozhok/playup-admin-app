// GET /api/client/events/{id} — 13, 07. Карточка только опубликованного события.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, optionalClient } from "@/lib/http";
import { serializeEventForClientDetail } from "@/lib/events";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { venue: true, host: true },
  });
  if (!event) return errorResponse("NOT_FOUND", "Event not found", 404);

  const userId = optionalClient(req);

  // Клиент видит карточку, если событие published, либо если он на него записан
  // (17 Flow 7: записанный пользователь должен увидеть отмену/изменения события).
  let userBookingStatus: string | null = null;
  let requiresProfileCompletion = true;
  let hasBooking = false;
  if (userId) {
    const active = await prisma.booking.findFirst({
      where: { eventId: event.id, userId, status: "booked" },
      select: { id: true },
    });
    hasBooking = Boolean(active);
    userBookingStatus = active ? "booked" : null;
    const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { profileCompletedAt: true } });
    requiresProfileCompletion = !profile?.profileCompletedAt;
  }

  if (event.status !== "published" && !hasBooking) {
    return errorResponse("NOT_FOUND", "Event not found", 404);
  }

  const bookedCount = await prisma.booking.count({ where: { eventId: event.id, status: "booked" } });

  return NextResponse.json(
    serializeEventForClientDetail(event, bookedCount, userBookingStatus, requiresProfileCompletion),
  );
}
