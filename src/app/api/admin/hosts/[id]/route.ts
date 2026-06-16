// PATCH /api/admin/hosts/{id} — 13
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

const PatchHost = z.object({
  name: z.string().min(1).optional(),
  telegram_username: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  default_fee: z.number().nullable().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = PatchHost.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid host", 400, body.error.flatten());
  const d = body.data;
  try {
    const host = await prisma.host.update({
      where: { id: params.id },
      data: {
        name: d.name,
        telegramUsername: d.telegram_username,
        phone: d.phone,
        defaultFee: d.default_fee,
        currency: d.currency,
        status: d.status,
        notes: d.notes,
      },
    });
    return NextResponse.json({ host });
  } catch {
    return errorResponse("NOT_FOUND", "Host not found", 404);
  }
}
