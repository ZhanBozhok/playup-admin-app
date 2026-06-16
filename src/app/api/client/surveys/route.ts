// GET /api/client/surveys — активные опросы по событиям, где пользователь был (attended),
// и на которые ещё не ответил (16: показываем при открытии mini app).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/http";

export async function GET(req: Request) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;

  const attended = await prisma.attendance.findMany({
    where: { userId: auth.userId, status: "attended" },
    select: { eventId: true },
  });
  const eventIds = attended.map((a) => a.eventId);
  if (eventIds.length === 0) return NextResponse.json({ surveys: [] });

  const surveys = await prisma.survey.findMany({
    where: {
      isActive: true,
      eventId: { in: eventIds },
      responses: { none: { userId: auth.userId } },
    },
    include: { event: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    surveys: surveys.map((s) => ({
      id: s.id,
      question: s.question,
      answer_type: s.answerType,
      event_title: s.event?.title ?? null,
      options: s.options ?? null,
    })),
  });
}
