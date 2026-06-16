// GET/PATCH /api/client/profile — 13, 06. Источник привлечения в клиенте не редактируется.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireClient, parseJson, errorResponse } from "@/lib/http";

function serialize(user: { telegramUsername: string | null }, p: any) {
  return {
    display_name: p?.displayName ?? null,
    telegram_username: user.telegramUsername,
    level: p?.level ?? null,
    preferred_sports: p?.preferredSports ?? [],
    preferred_area: p?.preferredArea ?? null,
    available_times: p?.availableTimes ?? [],
    traffic_source: p?.trafficSource ?? null,
    phone: p?.phone ?? null,
    profile_completed: Boolean(p?.profileCompletedAt),
  };
}

export async function GET(req: Request) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, include: { profile: true } });
  if (!user) return errorResponse("NOT_FOUND", "User not found", 404);
  return NextResponse.json({ profile: serialize(user, user.profile) });
}

const Patch = z.object({
  display_name: z.string().optional(),
  level: z.string().optional(),
  preferred_sports: z.array(z.string()).optional(),
  preferred_area: z.string().optional(),
  available_times: z.array(z.string()).optional(),
  phone: z.string().optional(),
});

export async function PATCH(req: Request) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;
  const body = Patch.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid profile", 400, body.error.flatten());
  const d = body.data;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return errorResponse("NOT_FOUND", "User not found", 404);

  const profile = await prisma.userProfile.upsert({
    where: { userId: auth.userId },
    update: {
      displayName: d.display_name,
      level: d.level,
      preferredSports: d.preferred_sports,
      preferredArea: d.preferred_area,
      availableTimes: d.available_times,
      phone: d.phone,
    },
    create: {
      userId: auth.userId,
      displayName: d.display_name,
      level: d.level,
      preferredSports: d.preferred_sports ?? [],
      preferredArea: d.preferred_area,
      availableTimes: d.available_times ?? [],
      phone: d.phone,
    },
  });
  return NextResponse.json({ profile: serialize(user, profile) });
}
