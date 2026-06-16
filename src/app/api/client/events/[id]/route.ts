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
  if (!event || event.status !== "published") {
    return errorResponse("NOT_FOUND", "Event not found", 404);
  }

  const bookedCount = await prisma.booking.count({ where: { eventId: event.id, status: "booked" } });

  const userId = optionalClient(req);
  let userBookingStatus: string | null = null;
  let requiresProfileCompletion = true;
  if (userId) {
    const active = await prisma.booking.findFirst({
      where: { eventId: event.id, userId, status: "booked" },
      select: { id: true },
    });
    userBookingStatus = active ? "booked" : null;
    const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { profileCompletedAt: true } });
    requiresProfileCompletion = !profile?.profileCompletedAt;
  }

  return NextResponse.json(
    serializeEventForClientDetail(event, bookedCount, userBookingStatus, requiresProfileCompletion),
  );
}
