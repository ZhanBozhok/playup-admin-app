"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Badge } from "@/components/ui";

type AdminEvent = {
  id: string;
  title: string;
  activity_type: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  venue: { id: string; name: string; address: string | null } | null;
  host: { id: string; name: string } | null;
  price: number;
  currency: string;
  capacity: number;
  min_quorum: number | null;
  level: string | null;
  status: string;
  booked_count: number;
  spots_left: number;
  risk_status: string;
};

const fmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { event } = await apiFetch<{ event: AdminEvent }>(`/api/admin/events/${params.id}`);
      setEvent(event);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function action(path: string, label: string) {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await apiFetch(`/api/admin/events/${params.id}/${path}`, { method: "POST", body: "{}" });
      setMsg(`${label} — готово`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (error && !event) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!event) return <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        title={event.title}
        action={
          <Link href="/dashboard/schedule">
            <Button variant="secondary">← К расписанию</Button>
          </Link>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <Badge kind="status" value={event.status} />
        {event.status === "published" && <Badge kind="risk" value={event.risk_status} />}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row label="Активность" value={event.activity_type} />
        <Row label="Когда" value={`${fmt.format(new Date(event.starts_at))} — ${fmt.format(new Date(event.ends_at))}`} />
        <Row label="Площадка" value={event.venue ? `${event.venue.name}${event.venue.address ? `, ${event.venue.address}` : ""}` : "—"} />
        <Row label="Хост" value={event.host?.name ?? "—"} />
        <Row label="Цена" value={`${event.price} ${event.currency}`} />
        <Row label="Вместимость / кворум" value={`${event.capacity} / ${event.min_quorum ?? "—"}`} />
        <Row label="Записи / свободно" value={`${event.booked_count} / ${event.spots_left}`} />
        <Row label="Уровень" value={event.level ?? "—"} />
        <Row label="Описание" value={event.description ?? "—"} />
      </Card>

      {msg && <p style={{ color: "var(--color-success)", fontSize: 13 }}>{msg}</p>}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/dashboard/events/${event.id}/edit`}>
          <Button variant="secondary">Редактировать</Button>
        </Link>
        {event.status === "draft" && (
          <Button onClick={() => action("publish", "Публикация")} disabled={busy}>
            Опубликовать
          </Button>
        )}
        {(event.status === "draft" || event.status === "published") && (
          <Button variant="danger" onClick={() => action("cancel", "Отмена события")} disabled={busy}>
            Отменить
          </Button>
        )}
        {event.status === "published" && (
          <Button onClick={() => action("complete", "Завершение")} disabled={busy}>
            Завершить
          </Button>
        )}
      </div>

      {event.status === "draft" && (
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12 }}>
          Для публикации нужны: название, активность, время, площадка, описание, цена, валюта, вместимость, кворум.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", padding: "8px 0", borderBottom: "1px solid var(--color-line)" }}>
      <div style={{ color: "var(--color-graphite-600)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
