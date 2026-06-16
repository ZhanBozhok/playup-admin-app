// POST /api/admin/notifications/preview — 20 (предпросмотр получателей)
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { previewRecipients, NotifyError } from "@/lib/notifications";

const Body = z.object({
  target_type: z.string(),
  target_filter: z
    .object({
      event_id: z.string().uuid().optional(),
      activity_type: z.string().optional(),
      traffic_source: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid body", 400, body.error.flatten());
  try {
    const result = await previewRecipients(body.data.target_type, body.data.target_filter ?? {});
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NotifyError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
}
