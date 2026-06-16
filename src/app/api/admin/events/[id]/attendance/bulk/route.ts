// POST /api/admin/events/{id}/attendance/bulk — 13, 17 Flow 9
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { setAttendanceBulk, PaymentError } from "@/lib/payments";

const Body = z.object({
  items: z.array(z.object({ user_id: z.string().uuid(), status: z.string() })).min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "items required", 400, body.error.flatten());
  try {
    await setAttendanceBulk(params.id, body.data.items, auth.sub);
  } catch (e) {
    if (e instanceof PaymentError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
  return NextResponse.json({ ok: true });
}
