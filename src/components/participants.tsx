"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, Button, inputStyle } from "@/components/ui";

type Participant = {
  user_id: string;
  booking_id: string;
  display_name: string | null;
  telegram_username: string | null;
  booking_status: string;
  attendance_status: string;
  payment_status: string;
  payment_amount: number | null;
};
type Cashbox = { id: string; name: string };

const ATT: [string, string][] = [
  ["attended", "Пришёл"],
  ["no_show", "No-show"],
  ["cancelled_before_event", "Отменил"],
];
const PAY = ["unpaid", "paid", "refunded", "waived"];

export function ParticipantsManager({
  eventId,
  price,
  currency,
  onChanged,
}: {
  eventId: string;
  price: number;
  currency: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Participant[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [cashbox, setCashbox] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [p, c] = await Promise.all([
      apiFetch<{ participants: Participant[] }>(`/api/admin/events/${eventId}/participants`),
      apiFetch<{ cashboxes: Cashbox[] }>(`/api/admin/cashboxes`),
    ]);
    setRows(p.participants);
    setCashboxes(c.cashboxes);
    if (!cashbox && c.cashboxes[0]) setCashbox(c.cashboxes[0].id);
    setAmounts(Object.fromEntries(p.participants.map((x) => [x.user_id, String(x.payment_amount ?? price)])));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [eventId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const attendance = (userId: string, status: string) =>
    run(() =>
      apiFetch(`/api/admin/events/${eventId}/attendance/bulk`, {
        method: "POST",
        body: JSON.stringify({ items: [{ user_id: userId, status }] }),
      }).then(() => {}),
    );

  const pay = (userId: string, status: string) =>
    run(() =>
      apiFetch(`/api/admin/events/${eventId}/payments/bulk`, {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              user_id: userId,
              status,
              amount: Number(amounts[userId] ?? price),
              cashbox_id: status === "paid" ? cashbox || null : null,
            },
          ],
        }),
      }).then(() => {}),
    );

  const bulkAttended = () =>
    run(() =>
      apiFetch(`/api/admin/events/${eventId}/attendance/bulk`, {
        method: "POST",
        body: JSON.stringify({ items: rows.map((r) => ({ user_id: r.user_id, status: "attended" })) }),
      }).then(() => {}),
    );

  const bulkPaid = () =>
    run(() =>
      apiFetch(`/api/admin/events/${eventId}/payments/bulk`, {
        method: "POST",
        body: JSON.stringify({
          items: rows.map((r) => ({ user_id: r.user_id, status: "paid", amount: price, cashbox_id: cashbox || null })),
        }),
      }).then(() => {}),
    );

  const applyPrice = () => setAmounts(Object.fromEntries(rows.map((r) => [r.user_id, String(price)])));

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: 12, borderBottom: "1px solid var(--color-line)" }}>
        <Button variant="secondary" onClick={bulkAttended} disabled={busy || rows.length === 0}>Все пришли</Button>
        <Button variant="secondary" onClick={applyPrice} disabled={rows.length === 0}>Применить цену ({price} {currency})</Button>
        <Button variant="secondary" onClick={bulkPaid} disabled={busy || rows.length === 0}>Все оплатили</Button>
        <span style={{ fontSize: 13, color: "var(--color-graphite-600)", marginLeft: "auto" }}>Касса:</span>
        <select style={{ ...inputStyle, width: "auto", padding: "8px 10px" }} value={cashbox} onChange={(e) => setCashbox(e.target.value)}>
          {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <p style={{ color: "var(--color-danger)", padding: "8px 12px", margin: 0 }}>{error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
        <thead>
          <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
            <th style={c}>Участник</th>
            <th style={c}>Явка</th>
            <th style={c}>Оплата</th>
            <th style={c}>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.booking_id} style={{ borderTop: "1px solid var(--color-line)" }}>
              <td style={c}>
                <div>{r.display_name ?? "—"}</div>
                <div style={{ color: "var(--color-muted)", fontSize: 12 }}>{r.telegram_username ? `@${r.telegram_username}` : ""}</div>
              </td>
              <td style={c}>
                <div style={{ display: "flex", gap: 4 }}>
                  {ATT.map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => attendance(r.user_id, r.attendance_status === v ? "unknown" : v)}
                      disabled={busy}
                      style={{
                        padding: "5px 9px",
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: "pointer",
                        border: "1px solid var(--color-line)",
                        background: r.attendance_status === v ? "var(--color-green-800)" : "transparent",
                        color: r.attendance_status === v ? "var(--color-cream-50)" : "var(--color-graphite-700)",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </td>
              <td style={c}>
                <select
                  value={r.payment_status}
                  disabled={busy}
                  onChange={(e) => pay(r.user_id, e.target.value)}
                  style={{ ...inputStyle, width: "auto", padding: "6px 8px" }}
                >
                  {PAY.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td style={c}>
                <input
                  style={{ ...inputStyle, width: 90, padding: "6px 8px" }}
                  type="number"
                  value={amounts[r.user_id] ?? ""}
                  onChange={(e) => setAmounts({ ...amounts, [r.user_id]: e.target.value })}
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td style={c} colSpan={4}>Пока никто не записан.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

const c: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top" };
