// GET/POST /api/admin/finance/categories — 13, 10
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // income | expense
  const categories = await prisma.financeCategory.findMany({
    where: { isActive: true, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}

const Create = z.object({
  name: z.string().min(1),
  type: z.enum(["income", "expense"]),
  parent_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Create.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid category", 400, body.error.flatten());
  const category = await prisma.financeCategory.create({
    data: { name: body.data.name, type: body.data.type, parentId: body.data.parent_id ?? null },
  });
  return NextResponse.json({ category }, { status: 201 });
}
