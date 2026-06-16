// POST /api/admin/notifications/send — 13, 09, 17 Flow 12
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";
import { createAndSend, NotifyError } from "@/lib/notifications";

const Body = z.object({
  type: z.string().optional(),
  target_type: z.string(),
  target_filter: z
    .object({
      event_id: z.string().uuid().optional(),
      activity_type: z.string().optional(),
      traffic_source: z.string().optional(),
    })
    .optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  event_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid body", 400, body.error.flatten());
  try {
    const result = await createAndSend({ ...body.data, adminId: auth.sub });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NotifyError) return errorResponse(e.code as never, e.message, e.status);
    throw e;
  }
}
