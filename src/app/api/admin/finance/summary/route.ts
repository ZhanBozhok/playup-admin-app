// GET /api/admin/finance/summary — 11, 21. Доход/расход/прибыль за период + балансы касс.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { financeSummary } from "@/lib/finance";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const u = new URL(req.url);
  const summary = await financeSummary(u.searchParams.get("from") ?? undefined, u.searchParams.get("to") ?? undefined);
  return NextResponse.json(summary);
}
