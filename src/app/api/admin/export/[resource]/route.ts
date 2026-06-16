// GET /api/admin/export/{resource}.csv — 13. users/events/bookings/attendance/payments/transactions/survey_responses
import { NextResponse } from "next/server";
import { requireAdmin, errorResponse } from "@/lib/http";
import { buildExport } from "@/lib/exports";

export async function GET(req: Request, { params }: { params: { resource: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const result = await buildExport(params.resource);
  if (!result) return errorResponse("NOT_FOUND", "Unknown export resource", 404);

  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
