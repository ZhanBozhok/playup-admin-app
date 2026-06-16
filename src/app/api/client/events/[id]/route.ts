// GET /api/client/events/{id} — 13, 07. Карточка только опубликованного события.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { serializeEventForClientDetail } from "@/lib/events";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { venue: true, host: true },
  });
  // Клиенту нельзя показывать draft/cancelled/completed как обычную карточку.
  if (!event || event.status !== "published") {
    return errorResponse("NOT_FOUND", "Event not found", 404);
  }
  return NextResponse.json(serializeEventForClientDetail(event, 0, null, true));
}
