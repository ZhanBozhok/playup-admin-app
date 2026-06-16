// GET (list by event) / POST (create) /api/admin/surveys — 09, 13, 20
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

const ANSWER_TYPES = ["rating_1_5", "rating_1_10", "text", "single_choice"];

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");
  const surveys = await prisma.survey.findMany({
    where: eventId ? { eventId } : {},
    include: { responses: { select: { answerValue: true } }, event: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    surveys: surveys.map((s) => {
      const values = s.responses.map((r) => (r.answerValue != null ? Number(r.answerValue) : null)).filter((v): v is number => v != null);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        id: s.id,
        title: s.title,
        question: s.question,
        answer_type: s.answerType,
        event_id: s.eventId,
        event_title: s.event?.title ?? null,
        is_active: s.isActive,
        response_count: s.responses.length,
        avg_value: avg != null ? Math.round(avg * 100) / 100 : null,
        created_at: s.createdAt.toISOString(),
      };
    }),
  });
}

const Create = z.object({
  event_id: z.string().uuid().nullable().optional(),
  title: z.string().optional(),
  question: z.string().min(1),
  answer_type: z.enum(["rating_1_5", "rating_1_10", "text", "single_choice"]).default("rating_1_5"),
  options: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Create.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid survey", 400, body.error.flatten());
  const d = body.data;
  if (!ANSWER_TYPES.includes(d.answer_type)) return errorResponse("VALIDATION_ERROR", "Bad answer_type", 400);

  const survey = await prisma.survey.create({
    data: {
      eventId: d.event_id ?? null,
      title: d.title ?? "Опрос после события",
      question: d.question,
      answerType: d.answer_type,
      options: d.options ? (d.options as object) : undefined,
      createdByAdminId: auth.sub,
    },
  });
  return NextResponse.json({ survey: { id: survey.id } }, { status: 201 });
}
