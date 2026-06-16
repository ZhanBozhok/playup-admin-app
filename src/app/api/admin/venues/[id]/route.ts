// PATCH /api/admin/venues/{id} — 13
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

const PatchVenue = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  map_url: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_telegram: z.string().nullable().optional(),
  default_cost: z.number().nullable().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = PatchVenue.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid venue", 400, body.error.flatten());
  const d = body.data;
  try {
    const venue = await prisma.venue.update({
      where: { id: params.id },
      data: {
        name: d.name,
        address: d.address,
        mapUrl: d.map_url,
        contactName: d.contact_name,
        contactPhone: d.contact_phone,
        contactTelegram: d.contact_telegram,
        defaultCost: d.default_cost,
        currency: d.currency,
        status: d.status,
        notes: d.notes,
      },
    });
    return NextResponse.json({ venue });
  } catch {
    return errorResponse("NOT_FOUND", "Venue not found", 404);
  }
}
