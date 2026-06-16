// GET (list) / POST (create) /api/admin/transactions — 13, 10, 17 Flow 11
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { listTransactions, createTransaction } from "@/lib/finance";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const u = new URL(req.url);
  const txs = await listTransactions({
    from: u.searchParams.get("from") ?? undefined,
    to: u.searchParams.get("to") ?? undefined,
    type: u.searchParams.get("type") ?? undefined,
    cashboxId: u.searchParams.get("cashbox_id") ?? undefined,
    eventId: u.searchParams.get("event_id") ?? undefined,
    categoryId: u.searchParams.get("category_id") ?? undefined,
  });
  return NextResponse.json({ transactions: txs });
}

const Create = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().refine((n) => n !== 0, "amount must not be zero"),
  currency: z.string().default("RSD"),
  cashbox_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  host_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  transaction_date: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Create.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid transaction", 400, body.error.flatten());
  const tx = await createTransaction(body.data, auth.sub);
  return NextResponse.json({ transaction: { id: tx.id } }, { status: 201 });
}
