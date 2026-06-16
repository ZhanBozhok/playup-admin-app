// GET /api/admin/data-quality — 22. Проверки качества данных.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { dataQuality } from "@/lib/exports";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const data = await dataQuality();
  return NextResponse.json(data);
}
