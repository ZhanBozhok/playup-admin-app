// PATCH /api/admin/users/{id}/profile — 13, 15. Админ правит профиль (включая источник).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

const Patch = z.object({
  display_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  preferred_sports: z.array(z.string()).optional(),
  preferred_area: z.string().nullable().optional(),
  available_times: z.array(z.string()).optional(),
  traffic_source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return errorResponse("NOT_FOUND", "User not found", 404);

  const body = Patch.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid profile", 400, body.error.flatten());
  const d = body.data;

  const profile = await prisma.userProfile.upsert({
    where: { userId: params.id },
    update: {
      displayName: d.display_name,
      phone: d.phone,
      level: d.level,
      preferredSports: d.preferred_sports,
      preferredArea: d.preferred_area,
      availableTimes: d.available_times,
      trafficSource: d.traffic_source,
      notes: d.notes,
    },
    create: {
      userId: params.id,
      displayName: d.display_name,
      phone: d.phone,
      level: d.level,
      preferredSports: d.preferred_sports ?? [],
      preferredArea: d.preferred_area,
      availableTimes: d.available_times ?? [],
      trafficSource: d.traffic_source,
      notes: d.notes,
    },
  });
  return NextResponse.json({ profile });
}
