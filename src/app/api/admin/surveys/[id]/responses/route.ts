// GET /api/admin/surveys/{id}/responses — 13. Ответы + средняя оценка.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, errorResponse } from "@/lib/http";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const survey = await prisma.survey.findUnique({ where: { id: params.id } });
  if (!survey) return errorResponse("NOT_FOUND", "Survey not found", 404);

  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId: params.id },
    include: { user: { include: { profile: { select: { displayName: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const values = responses.map((r) => (r.answerValue != null ? Number(r.answerValue) : null)).filter((v): v is number => v != null);
  const avg = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;

  return NextResponse.json({
    survey: { id: survey.id, question: survey.question, answer_type: survey.answerType },
    avg_value: avg,
    responses: responses.map((r) => ({
      user_name: r.user.profile?.displayName ?? r.user.telegramUsername ?? "—",
      answer_value: r.answerValue != null ? Number(r.answerValue) : null,
      answer_text: r.answerText,
      created_at: r.createdAt.toISOString(),
    })),
  });
}
