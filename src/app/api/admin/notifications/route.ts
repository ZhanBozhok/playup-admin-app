// GET /api/admin/notifications — история отправок (09, 13)
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { listNotifications } from "@/lib/notifications";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
