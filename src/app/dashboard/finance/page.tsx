"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle } from "@/components/ui";

type Summary = {
  revenue: number;
  expenses: number;
  profit: number;
  unpaid_amount: number;
  cashboxes: { id: string; name: string; currency: string; balance: number }[];
};
type Tx = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  cashbox: string | null;
  category: string | null;
  event_title: string | null;
  venue_name: string | null;
  description: string | null;
  transaction_date: string;
  payment_linked: boolean;
};
type Ref = { id: string; name: string };

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
const today = () => new Date().toISOString().slice(0, 10);

export default function FinancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cashboxes, setCashboxes] = useState<Ref[]>([]);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [typeFilter, setTypeFilter] = useState("");
  const [cashboxFilter, setCashboxFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<null | "income" | "expense">(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ from, to });
    apiFetch<Summary>(`/api/admin/finance/summary?${q}`).then(setSummary).catch((e) => setError(e.message));
    const tq = new URLSearchParams({ from, to });
    if (typeFilter) tq.set("type", typeFilter);
    if (cashboxFilter) tq.set("cashbox_id", cashboxFilter);
    apiFetch<{ transactions: Tx[] }>(`/api/admin/transactions?${tq}`).then((d) => setTxs(d.transactions)).catch((e) => setError(e.message));
  }, [from, to, typeFilter, cashboxFilter]);

  useEffect(() => {
    apiFetch<{ cashboxes: Ref[] }>("/api/admin/cashboxes").then((d) => setCashboxes(d.cashboxes)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function del(id: string) {
    try {
      await apiFetch(`/api/admin/transactions/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div>
      <PageHeader
        title="Финансы"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowForm(showForm === "income" ? null : "income")}>+ Доход</Button>
            <Button onClick={() => setShowForm(showForm === "expense" ? null : "expense")}>+ Расход</Button>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "end", flexWrap: "wrap" }}>
        <Field label="С"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="По"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {summary && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <Metric label="Доход за период" value={`${summary.revenue}`} />
            <Metric label="Расход за период" value={`${summary.expenses}`} />
            <Metric label="Прибыль" value={`${summary.profit}`} />
            <Metric label="Неоплачено" value={`${summary.unpaid_amount}`} />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {summary.cashboxes.map((c) => (
              <div key={c.id} style={{ background: "var(--color-green-900)", color: "var(--color-cream-50)", borderRadius: "var(--radius-md)", padding: "10px 16px" }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{c.name}</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>{c.balance} {c.currency}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <AddTxForm
          kind={showForm}
          cashboxes={cashboxes}
          onClose={() => setShowForm(null)}
          onSaved={() => {
            setShowForm(null);
            load();
          }}
        />
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <select style={{ ...inputStyle, width: "auto", padding: "8px 10px" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Все типы</option>
          <option value="income">Доходы</option>
          <option value="expense">Расходы</option>
        </select>
        <select style={{ ...inputStyle, width: "auto", padding: "8px 10px" }} value={cashboxFilter} onChange={(e) => setCashboxFilter(e.target.value)}>
          <option value="">Все кассы</option>
          {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
              <th style={c}>Дата</th><th style={c}>Тип</th><th style={c}>Сумма</th><th style={c}>Касса</th>
              <th style={c}>Категория</th><th style={c}>Событие</th><th style={c}>Описание</th><th style={c}></th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                <td style={c}>{t.transaction_date}</td>
                <td style={{ ...c, color: t.type === "income" ? "var(--color-success)" : "var(--color-danger)" }}>
                  {t.type === "income" ? "доход" : t.type === "expense" ? "расход" : t.type}
                </td>
                <td style={c}>{t.amount} {t.currency}</td>
                <td style={c}>{t.cashbox ?? "—"}</td>
                <td style={c}>{t.category ?? "—"}</td>
                <td style={c}>{t.event_title ?? t.venue_name ?? "—"}</td>
                <td style={c}>{t.description ?? "—"}</td>
                <td style={c}>
                  {!t.payment_linked && (
                    <button onClick={() => del(t.id)} style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: 16 }}>×</button>
                  )}
                </td>
              </tr>
            ))}
            {txs.length === 0 && <tr><td style={c} colSpan={8}>Транзакций за период нет.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddTxForm({
  kind,
  cashboxes,
  onClose,
  onSaved,
}: {
  kind: "income" | "expense";
  cashboxes: Ref[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<Ref[]>([]);
  const [amount, setAmount] = useState("");
  const [cashbox, setCashbox] = useState("");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ categories: Ref[] }>(`/api/admin/finance/categories?type=${kind}`).then((d) => setCategories(d.categories)).catch(() => {});
  }, [kind]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: kind,
          amount: Number(amount),
          cashbox_id: cashbox || null,
          category_id: category || null,
          description: desc || undefined,
          transaction_date: date,
        }),
      });
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, marginBottom: 12 }}>
        {kind === "income" ? "Добавить доход" : "Добавить расход"}
      </div>
      <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
        <Field label="Сумма"><input type="number" min="1" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Касса">
          <select style={inputStyle} value={cashbox} onChange={(e) => setCashbox(e.target.value)} required>
            <option value="">—</option>
            {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Категория">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Дата"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Описание"><input style={inputStyle} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </div>
        {err && <div style={{ gridColumn: "1 / -1", color: "var(--color-danger)", fontSize: 13 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
        </div>
      </form>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--color-graphite-600)" }}>{label}</div>
      <div className="tabular" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const c: React.CSSProperties = { padding: "10px 12px" };
