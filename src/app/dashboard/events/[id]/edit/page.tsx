"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle, ACTIVITY_TYPES, LEVELS } from "@/components/ui";

type Ref = { id: string; name: string };

// datetime-local ожидает "YYYY-MM-DDTHH:mm" в локальном времени
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [venues, setVenues] = useState<Ref[]>([]);
  const [hosts, setHosts] = useState<Ref[]>([]);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ venues: Ref[] }>("/api/admin/venues").then((d) => setVenues(d.venues)).catch(() => {});
    apiFetch<{ hosts: Ref[] }>("/api/admin/hosts").then((d) => setHosts(d.hosts)).catch(() => {});
    apiFetch<{ event: any }>(`/api/admin/events/${params.id}`)
      .then(({ event }) =>
        setForm({
          title: event.title,
          activity_type: event.activity_type,
          description: event.description ?? "",
          starts_at: toLocalInput(event.starts_at),
          ends_at: toLocalInput(event.ends_at),
          venue_id: event.venue?.id ?? "",
          host_id: event.host?.id ?? "",
          price: String(event.price),
          currency: event.currency,
          capacity: String(event.capacity),
          min_quorum: event.min_quorum != null ? String(event.min_quorum) : "",
          level: event.level ?? "",
        }),
      )
      .catch((e) => setError(e.message));
  }, [params.id]);

  function set(k: string, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/events/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          activity_type: form.activity_type,
          description: form.description || null,
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
          venue_id: form.venue_id || null,
          host_id: form.host_id || null,
          price: Number(form.price),
          currency: form.currency,
          capacity: Number(form.capacity),
          min_quorum: form.min_quorum ? Number(form.min_quorum) : null,
          level: form.level || null,
        }),
      });
      router.push(`/dashboard/events/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (error && !form) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!form) return <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title="Редактировать событие" />
      <Card>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <Field label="Название">
            <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Активность">
              <select style={inputStyle} value={form.activity_type} onChange={(e) => set("activity_type", e.target.value)}>
                {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Уровень">
              <select style={inputStyle} value={form.level} onChange={(e) => set("level", e.target.value)}>
                <option value="">—</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Описание">
            <textarea style={{ ...inputStyle, minHeight: 72 }} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Начало">
              <input type="datetime-local" style={inputStyle} value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} required />
            </Field>
            <Field label="Окончание">
              <input type="datetime-local" style={inputStyle} value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} required />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Площадка">
              <select style={inputStyle} value={form.venue_id} onChange={(e) => set("venue_id", e.target.value)}>
                <option value="">— не выбрана —</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="Хост">
              <select style={inputStyle} value={form.host_id} onChange={(e) => set("host_id", e.target.value)}>
                <option value="">— не выбран —</option>
                {hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
            <Field label="Цена">
              <input type="number" min="0" style={inputStyle} value={form.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="Валюта">
              <input style={inputStyle} value={form.currency} onChange={(e) => set("currency", e.target.value)} />
            </Field>
            <Field label="Вместимость">
              <input type="number" min="1" style={inputStyle} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} required />
            </Field>
            <Field label="Кворум">
              <input type="number" min="1" style={inputStyle} value={form.min_quorum} onChange={(e) => set("min_quorum", e.target.value)} />
            </Field>
          </div>
          {error && <div style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
            <Button type="button" variant="secondary" onClick={() => router.push(`/dashboard/events/${params.id}`)}>
              Отмена
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
