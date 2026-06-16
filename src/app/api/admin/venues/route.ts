// GET/POST /api/admin/venues — 13
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const venues = await prisma.venue.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ venues });
}

const CreateVenue = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  map_url: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_telegram: z.string().optional(),
  default_cost: z.number().optional(),
  currency: z.string().default("RSD"),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = CreateVenue.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "Invalid venue", 400, body.error.flatten());
  const d = body.data;
  const venue = await prisma.venue.create({
    data: {
      name: d.name,
      address: d.address,
      mapUrl: d.map_url,
      contactName: d.contact_name,
      contactPhone: d.contact_phone,
      contactTelegram: d.contact_telegram,
      defaultCost: d.default_cost,
      currency: d.currency,
      notes: d.notes,
    },
  });
  return NextResponse.json({ venue }, { status: 201 });
}
