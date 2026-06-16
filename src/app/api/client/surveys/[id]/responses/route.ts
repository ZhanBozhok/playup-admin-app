// POST /api/client/surveys/{id}/responses — 13, 17 Flow 13
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireClient, parseJson, errorResponse } from "@/lib/http";

const Body = z.object({
  answer_value: z.number().nullable().optional(),
  answer_text: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = requireClient(req);
  if (auth instanceof NextResponse) return auth;

  const survey = await prisma.survey.findUnique({ where: { id: params.id } });
  if (!survey || !survey.isActive) return errorResponse("NOT_FOUND", "Survey not found", 404);

  const body = Body.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid response", 400, body.error.flatten());
  if (body.data.answer_value == null && !body.data.answer_text?.trim()) {
    return errorResponse("VALIDATION_ERROR", "Нужна оценка или комментарий", 400);
  }

  // upsert: один ответ на (survey,user); повторный — обновляет
  const response = await prisma.surveyResponse.upsert({
    where: { uniq_survey_response_user: { surveyId: params.id, userId: auth.userId } },
    update: { answerValue: body.data.answer_value ?? null, answerText: body.data.answer_text ?? null, eventId: survey.eventId },
    create: {
      surveyId: params.id,
      userId: auth.userId,
      eventId: survey.eventId,
      answerValue: body.data.answer_value ?? null,
      answerText: body.data.answer_text ?? null,
    },
  });
  return NextResponse.json({ response: { id: response.id } }, { status: 201 });
}
