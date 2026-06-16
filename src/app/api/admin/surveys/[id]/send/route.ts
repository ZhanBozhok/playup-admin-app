// POST /api/admin/surveys/{id}/send — отправка опроса attended-участникам (09/20).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, errorResponse } from "@/lib/http";
import { createAndSend, NotifyError } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const survey = await prisma.survey.findUnique({ where: { id: params.id } });
  if (!survey) return errorResponse("NOT_FOUND", "Survey not found", 404);
  if (!survey.eventId) return errorResponse("VALIDATION_ERROR", "Survey is not linked to an event", 400);

  // Защита (20): нельзя слать post-event survey до окончания события.
  const event = await prisma.event.findUnique({ where: { id: survey.eventId }, select: { endsAt: true } });
  if (!event) return errorResponse("NOT_FOUND", "Event not found", 404);
  if (event.endsAt > new Date()) {
    return errorResponse("VALIDATION_ERROR", "Событие ещё не закончилось — опрос отправлять рано", 400);
  }

  try {
    const result = await createAndSend({
      type: "post_event_survey",
      target_type: "event_attended",
      event_id: survey.eventId,
      message: `${survey.question}\n\nОтветь, пожалуйста, в приложении PlayUp.`,
      adminId: auth.sub,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NotifyError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
}
