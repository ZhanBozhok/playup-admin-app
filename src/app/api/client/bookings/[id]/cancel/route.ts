// POST /api/client/bookings/{id}/cancel — 13, 17 Flow 5
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClient, parseJson, errorResponse } from "@/lib/http";
import { cancelBooking, BookingError } from "@/lib/bookings";

const Body = z.object({ reason: z.string().optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse((await parseJson(req)) ?? {});
  const reason = parsed.success ? parsed.data.reason : undefined;

  try {
    const booking = await cancelBooking(auth.userId, params.id, reason);
    return NextResponse.json({ booking: { id: booking.id, status: booking.status } });
  } catch (e) {
    if (e instanceof BookingError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
}
