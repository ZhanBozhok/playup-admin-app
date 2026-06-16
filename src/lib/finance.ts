// Финансы — 10, 13, 21. Любое движение денег = Transaction; баланс кассы = income − expense.
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export type TxFilters = {
  from?: string;
  to?: string;
  type?: string;
  cashboxId?: string;
  eventId?: string;
  categoryId?: string;
};

export async function listTransactions(f: TxFilters) {
  const where: Prisma.TransactionWhereInput = {};
  if (f.type) where.type = f.type;
  if (f.cashboxId) where.cashboxId = f.cashboxId;
  if (f.eventId) where.eventId = f.eventId;
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.from || f.to) {
    where.transactionDate = {};
    if (f.from) where.transactionDate.gte = new Date(f.from);
    if (f.to) where.transactionDate.lte = new Date(f.to);
  }

  const txs = await prisma.transaction.findMany({
    where,
    include: {
      cashbox: { select: { name: true } },
      category: { select: { name: true } },
      event: { select: { title: true } },
      venue: { select: { name: true } },
      host: { select: { name: true } },
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return txs.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    cashbox: t.cashbox?.name ?? null,
    category: t.category?.name ?? null,
    event_title: t.event?.title ?? null,
    venue_name: t.venue?.name ?? null,
    host_name: t.host?.name ?? null,
    description: t.description,
    transaction_date: t.transactionDate.toISOString().slice(0, 10),
    payment_linked: t.paymentId != null,
  }));
}

export type CreateTxInput = {
  type: "income" | "expense" | "transfer";
  amount: number;
  currency?: string;
  cashbox_id?: string | null;
  category_id?: string | null;
  event_id?: string | null;
  venue_id?: string | null;
  host_id?: string | null;
  user_id?: string | null;
  description?: string;
  transaction_date?: string;
};

export async function createTransaction(input: CreateTxInput, adminId: string) {
  return prisma.transaction.create({
    data: {
      type: input.type,
      amount: input.amount,
      currency: input.currency ?? "RSD",
      cashboxId: input.cashbox_id ?? null,
      categoryId: input.category_id ?? null,
      eventId: input.event_id ?? null,
      venueId: input.venue_id ?? null,
      hostId: input.host_id ?? null,
      userId: input.user_id ?? null,
      description: input.description ?? null,
      transactionDate: input.transaction_date ? new Date(input.transaction_date) : new Date(),
      createdByAdminId: adminId,
    },
  });
}

// Сводка: доход/расход/прибыль за период + баланс по кассам (всё время) + неоплачено.
export async function financeSummary(from?: string, to?: string) {
  const periodWhere: Prisma.TransactionWhereInput = {};
  if (from || to) {
    periodWhere.transactionDate = {};
    if (from) periodWhere.transactionDate.gte = new Date(from);
    if (to) periodWhere.transactionDate.lte = new Date(to);
  }

  const [incomeAgg, expenseAgg, byCashbox, unpaidAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...periodWhere, type: "income" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...periodWhere, type: "expense" }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ["cashboxId", "type"], _sum: { amount: true } }),
    // неоплачено: payment unpaid с активной записью (booking booked)
    prisma.payment.aggregate({ where: { status: "unpaid", booking: { status: "booked" } }, _sum: { amount: true } }),
  ]);

  const cashboxes = await prisma.cashbox.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const balanceMap = new Map<string, number>();
  for (const row of byCashbox) {
    if (!row.cashboxId) continue;
    const cur = balanceMap.get(row.cashboxId) ?? 0;
    const amt = Number(row._sum.amount ?? 0);
    balanceMap.set(row.cashboxId, cur + (row.type === "income" ? amt : row.type === "expense" ? -amt : 0));
  }

  const revenue = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    unpaid_amount: Number(unpaidAgg._sum.amount ?? 0),
    cashboxes: cashboxes.map((c) => ({
      id: c.id,
      name: c.name,
      currency: c.currency,
      balance: balanceMap.get(c.id) ?? 0,
    })),
  };
}
