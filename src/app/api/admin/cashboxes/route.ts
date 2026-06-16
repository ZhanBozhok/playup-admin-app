// GET/POST /api/admin/cashboxes — 13
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const cashboxes = await prisma.cashbox.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ cashboxes });
}

const Create = z.object({
  name: z.string().min(1),
  type: z.enum(["cash", "bank", "crypto", "other"]),
  currency: z.string().default("RSD"),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Create.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid cashbox", 400, body.error.flatten());
  const cashbox = await prisma.cashbox.create({ data: body.data });
  return NextResponse.json({ cashbox }, { status: 201 });
}
