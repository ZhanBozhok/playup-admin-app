// Посещаемость и оплаты — 08, 13, 17 (Flow 9–10), 19. Payment != Transaction.
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export const ATTENDANCE_STATUSES = ["unknown", "attended", "no_show", "cancelled_before_event"];
export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "waived"];

// Категория дохода "Event payment" (14/23) — кэшируем поиск/создание.
async function eventPaymentCategoryId(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.financeCategory.findFirst({ where: { name: "Event payment", type: "income" } });
  if (existing) return existing.id;
  const created = await tx.financeCategory.create({ data: { name: "Event payment", type: "income" } });
  return created.id;
}

// Bulk-отметка явки (Flow 9). items: [{ user_id, status }].
export async function setAttendanceBulk(
  eventId: string,
  items: { user_id: string; status: string }[],
  adminId: string,
) {
  const now = new Date();
  for (const it of items) {
    if (!ATTENDANCE_STATUSES.includes(it.status)) continue;
    await prisma.attendance.upsert({
      where: { uniq_attendance_event_user: { eventId, userId: it.user_id } },
      update: { status: it.status, markedByAdminId: adminId, markedAt: now },
      create: { eventId, userId: it.user_id, status: it.status, markedByAdminId: adminId, markedAt: now },
    });
  }
}

type PaymentItem = {
  user_id: string;
  status: string;
  amount?: number;
  cashbox_id?: string | null;
  notes?: string;
};

/**
 * Bulk-отметка оплат (Flow 10). При paid создаётся/обновляется income-Transaction,
 * привязанная к payment/user/event/cashbox. При не-paid связанная транзакция удаляется
 * (revenue = sum(income) остаётся корректной; waived/refunded не дают выручки — 08/19).
 */
export async function setPaymentsBulk(eventId: string, items: PaymentItem[], adminId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");

  for (const it of items) {
    if (!PAYMENT_STATUSES.includes(it.status)) continue;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { uniq_payment_event_user: { eventId, userId: it.user_id } },
      });
      const amount = it.amount != null ? it.amount : existing ? Number(existing.amount) : Number(event.price);
      const paidAt = it.status === "paid" ? existing?.paidAt ?? new Date() : null;

      const payment = await tx.payment.upsert({
        where: { uniq_payment_event_user: { eventId, userId: it.user_id } },
        update: {
          status: it.status,
          amount,
          currency: event.currency,
          cashboxId: it.cashbox_id ?? existing?.cashboxId ?? null,
          paidAt,
          markedByAdminId: adminId,
          notes: it.notes ?? existing?.notes ?? null,
        },
        create: {
          eventId,
          userId: it.user_id,
          status: it.status,
          amount,
          currency: event.currency,
          cashboxId: it.cashbox_id ?? null,
          paidAt,
          markedByAdminId: adminId,
          notes: it.notes ?? null,
        },
      });

      // Согласование income-транзакции
      const linked = await tx.transaction.findFirst({ where: { paymentId: payment.id, type: "income" } });
      if (it.status === "paid") {
        const categoryId = await eventPaymentCategoryId(tx);
        if (linked) {
          await tx.transaction.update({
            where: { id: linked.id },
            data: { amount, currency: event.currency, cashboxId: payment.cashboxId, categoryId },
          });
        } else {
          await tx.transaction.create({
            data: {
              type: "income",
              amount,
              currency: event.currency,
              cashboxId: payment.cashboxId,
              categoryId,
              eventId,
              userId: it.user_id,
              paymentId: payment.id,
              description: `Оплата участия: ${event.title}`,
              transactionDate: new Date(),
              createdByAdminId: adminId,
            },
          });
        }
      } else if (linked) {
        // unpaid / refunded / waived — снимаем доход
        await tx.transaction.delete({ where: { id: linked.id } });
      }
    });
  }
}

// Финансовая сводка по событию (15/21): revenue/expenses/profit + неоплачено.
// Неоплачено считаем только по активным участникам (booking='booked') — 21.
export async function eventFinance(eventId: string) {
  const activeBookings = await prisma.booking.findMany({
    where: { eventId, status: "booked" },
    select: { userId: true },
  });
  const activeUserIds = activeBookings.map((b) => b.userId);

  const [incomeAgg, expenseAgg, unpaidAgg, paidCount] = await Promise.all([
    prisma.transaction.aggregate({ where: { eventId, type: "income" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { eventId, type: "expense" }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { eventId, status: "unpaid", userId: { in: activeUserIds } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { eventId, status: "paid" } }),
  ]);
  const revenue = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    unpaid_amount: Number(unpaidAgg._sum.amount ?? 0),
    paid_count: paidCount,
  };
}
