// GET /api/admin/users — 13, 15. Поиск + фильтры; метрики для списка.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/http";
import { listMetrics, deriveStatus } from "@/lib/users";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status"); // new|active|sleeping|blocked
  const source = url.searchParams.get("source");
  const level = url.searchParams.get("level");
  const activity = url.searchParams.get("activity_type");
  const hasNoShow = url.searchParams.get("has_no_show") === "true";

  const where: Prisma.UserWhereInput = {};
  const profileWhere: Prisma.UserProfileWhereInput = {};
  if (source) profileWhere.trafficSource = source;
  if (level) profileWhere.level = level;
  if (activity) profileWhere.preferredSports = { has: activity };
  if (Object.keys(profileWhere).length) where.profile = profileWhere;

  if (search) {
    where.OR = [
      { telegramUsername: { contains: search, mode: "insensitive" } },
      { profile: { displayName: { contains: search, mode: "insensitive" } } },
      { profile: { phone: { contains: search } } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });

  const metrics = await listMetrics(users.map((u) => u.id));
  const now = new Date();

  let rows = users.map((u) => {
    const m = metrics.get(u.id)!;
    return {
      id: u.id,
      telegram_username: u.telegramUsername,
      display_name: u.profile?.displayName ?? null,
      level: u.profile?.level ?? null,
      preferred_sports: u.profile?.preferredSports ?? [],
      traffic_source: u.profile?.trafficSource ?? null,
      status: deriveStatus(u.status, m.last_attended_at, now),
      attended: m.attended,
      no_show: m.no_show,
      total_bookings: m.total_bookings,
      last_seen_at: u.lastSeenAt?.toISOString() ?? null,
      created_at: u.createdAt.toISOString(),
    };
  });

  // статус и has_no_show — производные, фильтруем в приложении
  if (status) rows = rows.filter((r) => r.status === status);
  if (hasNoShow) rows = rows.filter((r) => r.no_show > 0);

  return NextResponse.json({ users: rows });
}
