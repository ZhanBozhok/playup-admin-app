"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle, ACTIVITY_TYPES, LEVELS } from "@/components/ui";

type Ref = { id: string; name: string };

function NewEventForm() {
  const router = useRouter();
  const search = useSearchParams();
  const dateParam = search.get("date");

  const [venues, setVenues] = useState<Ref[]>([]);
  const [hosts, setHosts] = useState<Ref[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultStart = `${dateParam ?? new Date().toISOString().slice(0, 10)}T18:00`;
  const defaultEnd = `${dateParam ?? new Date().toISOString().slice(0, 10)}T19:30`;

  const [form, setForm] = useState({
    title: "",
    activity_type: "football",
    description: "",
    starts_at: defaultStart,
    ends_at: defaultEnd,
    venue_id: "",
    host_id: "",
    price: "0",
    currency: "RSD",
    capacity: "12",
    min_quorum: "",
    level: "mixed",
  });

  useEffect(() => {
    apiFetch<{ venues: Ref[] }>("/api/admin/venues").then((d) => setVenues(d.venues)).catch(() => {});
    apiFetch<{ hosts: Ref[] }>("/api/admin/hosts").then((d) => setHosts(d.hosts)).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        activity_type: form.activity_type,
        description: form.description || undefined,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        venue_id: form.venue_id || null,
        host_id: form.host_id || null,
        price: Number(form.price),
        currency: form.currency,
        capacity: Number(form.capacity),
        min_quorum: form.min_quorum ? Number(form.min_quorum) : null,
        level: form.level || null,
      };
      const { event } = await apiFetch<{ event: { id: string } }>("/api/admin/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/dashboard/events/${event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title="Новое событие" />
      <Card>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <Field label="Название">
            <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Активность">
              <select style={inputStyle} value={form.activity_type} onChange={(e) => set("activity_type", e.target.value)}>
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Уровень">
              <select style={inputStyle} value={form.level} onChange={(e) => set("level", e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Описание">
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
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
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Хост">
              <select style={inputStyle} value={form.host_id} onChange={(e) => set("host_id", e.target.value)}>
                <option value="">— не выбран —</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
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
            <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить черновик"}</Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard/schedule")}>
              Отмена
            </Button>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>
            Событие создаётся черновиком. Опубликовать можно на карточке события.
          </p>
        </form>
      </Card>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>}>
      <NewEventForm />
    </Suspense>
  );
}
