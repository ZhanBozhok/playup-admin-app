// GET/POST /api/admin/events/{id}/participants — 13, 15
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { createBooking, BookingError } from "@/lib/bookings";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const eventId = params.id;
  const bookings = await prisma.booking.findMany({
    where: { eventId, status: { in: ["booked", "admin_removed"] } },
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: "asc" },
  });

  // явка и оплаты по событию — для джойна к участникам
  const [attendance, payments] = await Promise.all([
    prisma.attendance.findMany({ where: { eventId } }),
    prisma.payment.findMany({ where: { eventId } }),
  ]);
  const attByUser = new Map(attendance.map((a) => [a.userId, a]));
  const payByUser = new Map(payments.map((p) => [p.userId, p]));

  const participants = bookings.map((b) => {
    const pay = payByUser.get(b.userId);
    return {
      user_id: b.userId,
      booking_id: b.id,
      display_name: b.user.profile?.displayName ?? null,
      telegram_username: b.user.telegramUsername,
      booking_status: b.status,
      attendance_status: attByUser.get(b.userId)?.status ?? "unknown",
      payment_status: pay?.status ?? "unpaid",
      payment_amount: pay ? Number(pay.amount) : null,
    };
  });

  return NextResponse.json({ participants });
}

const AddBody = z.object({ user_id: z.string().uuid() });

// Ручное добавление участника (07): админ записывает существующего пользователя.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = AddBody.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "user_id required", 400);

  try {
    const { booking, spotsLeft } = await createBooking(body.data.user_id, params.id, undefined, {
      requireProfile: false,
    });
    return NextResponse.json({ booking: { id: booking.id, status: booking.status }, spots_left: spotsLeft }, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
}
