// DELETE /api/admin/transactions/{id} — ручная коррекция. Нельзя удалять
// транзакции, привязанные к Payment (их меняет логика оплат — 08/19).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, errorResponse } from "@/lib/http";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx) return errorResponse("NOT_FOUND", "Transaction not found", 404);
  if (tx.paymentId) {
    return errorResponse("VALIDATION_ERROR", "Связана с оплатой — менять через оплату участника", 400);
  }
  await prisma.transaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
