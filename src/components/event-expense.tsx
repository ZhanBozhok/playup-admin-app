"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, Button, Field, inputStyle } from "@/components/ui";

type Ref = { id: string; name: string };

// Добавление расхода, привязанного к событию (10, 17 Flow 11). Обновляет прибыль события.
export function EventExpense({
  eventId,
  venueId,
  hostId,
  onSaved,
}: {
  eventId: string;
  venueId: string | null;
  hostId: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cashboxes, setCashboxes] = useState<Ref[]>([]);
  const [categories, setCategories] = useState<Ref[]>([]);
  const [amount, setAmount] = useState("");
  const [cashbox, setCashbox] = useState("");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [linkVenue, setLinkVenue] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ cashboxes: Ref[] }>("/api/admin/cashboxes").then((d) => setCashboxes(d.cashboxes)).catch(() => {});
    apiFetch<{ categories: Ref[] }>("/api/admin/finance/categories?type=expense").then((d) => setCategories(d.categories)).catch(() => {});
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: Number(amount),
          cashbox_id: cashbox || null,
          category_id: category || null,
          event_id: eventId,
          venue_id: linkVenue ? venueId : null,
          host_id: hostId,
          description: desc || undefined,
        }),
      });
      setAmount(""); setDesc(""); setCategory("");
      setOpen(false);
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <Button variant="secondary" onClick={() => setOpen(true)}>+ Расход события</Button>;
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, marginBottom: 12 }}>Расход события</div>
      <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
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
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Описание (напр. площадка, вода, хост)"><input style={inputStyle} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </div>
        {venueId && (
          <label style={{ gridColumn: "1 / -1", display: "flex", gap: 6, fontSize: 13, color: "var(--color-graphite-600)" }}>
            <input type="checkbox" checked={linkVenue} onChange={(e) => setLinkVenue(e.target.checked)} /> привязать к площадке события
          </label>
        )}
        {err && <div style={{ gridColumn: "1 / -1", color: "var(--color-danger)", fontSize: 13 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Добавить расход"}</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
        </div>
      </form>
    </Card>
  );
}
