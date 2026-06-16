// GET/POST /api/admin/users/{id}/notes — заметки админа о пользователе (06/15).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, parseJson, errorResponse } from "@/lib/http";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const notes = await prisma.adminNote.findMany({
    where: { entityType: "user", entityId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ notes: notes.map((n) => ({ id: n.id, note: n.note, created_at: n.createdAt.toISOString() })) });
}

const Body = z.object({ note: z.string().min(1) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await parseJson(req));
  if (!body.success) return errorResponse("VALIDATION_ERROR", "note required", 400);

  const note = await prisma.adminNote.create({
    data: { entityType: "user", entityId: params.id, note: body.data.note, createdByAdminId: auth.sub },
  });
  return NextResponse.json({ note: { id: note.id, note: note.note, created_at: note.createdAt.toISOString() } }, { status: 201 });
}
