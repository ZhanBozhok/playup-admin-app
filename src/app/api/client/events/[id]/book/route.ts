// POST /api/client/events/{id}/book — 13, 17 Flow 3/4
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClient, parseJson, errorResponse } from "@/lib/http";
import { createBooking, BookingError, type ProfileInput } from "@/lib/bookings";

const Body = z.object({
  profile: z
    .object({
      display_name: z.string().optional(),
      level: z.string().optional(),
      preferred_sports: z.array(z.string()).optional(),
      preferred_area: z.string().optional(),
      traffic_source: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse((await parseJson(req)) ?? {});
  const profile = parsed.success ? (parsed.data.profile as ProfileInput | undefined) : undefined;

  try {
    const { booking, spotsLeft } = await createBooking(auth.userId, params.id, profile);
    return NextResponse.json({
      booking: { id: booking.id, status: booking.status },
      event: { id: params.id, spots_left: spotsLeft, user_booking_status: "booked" },
    });
  } catch (e) {
    if (e instanceof BookingError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
}
