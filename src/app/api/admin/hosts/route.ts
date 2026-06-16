// GET/POST /api/admin/hosts — 13
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const hosts = await prisma.host.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ hosts });
}

const CreateHost = z.object({
  name: z.string().min(1),
  telegram_username: z.string().optional(),
  phone: z.string().optional(),
  default_fee: z.number().optional(),
  currency: z.string().default("RSD"),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = CreateHost.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid host", 400, body.error.flatten());
  const d = body.data;
  const host = await prisma.host.create({
    data: {
      name: d.name,
      telegramUsername: d.telegram_username,
      phone: d.phone,
      defaultFee: d.default_fee,
      currency: d.currency,
      notes: d.notes,
    },
  });
  return NextResponse.json({ host }, { status: 201 });
}
