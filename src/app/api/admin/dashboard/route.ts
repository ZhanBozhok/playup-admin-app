// GET /api/admin/dashboard — 13, 11
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { getDashboard } from "@/lib/dashboard";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const data = await getDashboard();
  return NextResponse.json(data);
}
