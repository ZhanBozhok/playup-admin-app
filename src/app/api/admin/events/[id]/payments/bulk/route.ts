// POST /api/admin/events/{id}/payments/bulk — 13, 17 Flow 10 (paid -> income transaction)
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { setPaymentsBulk } from "@/lib/payments";

const Body = z.object({
  items: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        status: z.string(),
        amount: z.number().nonnegative().optional(),
        cashbox_id: z.string().uuid().nullable().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "items required", 400, body.error.flatten());
  await setPaymentsBulk(params.id, body.data.items, auth.sub);
  return NextResponse.json({ ok: true });
}
