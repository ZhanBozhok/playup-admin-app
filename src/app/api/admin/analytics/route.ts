// GET /api/admin/analytics — 11, 21
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { getAnalytics } from "@/lib/analytics";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const u = new URL(req.url);
  const data = await getAnalytics(u.searchParams.get("from") ?? undefined, u.searchParams.get("to") ?? undefined);
  return NextResponse.json(data);
}
