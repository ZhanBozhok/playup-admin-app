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

const ATT_LABEL: Record<string, string> = {
  unknown: "—",
  attended: "пришёл",
  no_show: "no-show",
  cancelled_before_event: "отменил",
};
const PAY_LABEL: Record<string, string> = { unpaid: "не оплачено", paid: "оплачено", refunded: "возврат", waived: "списано" };

const fmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { event } = await apiFetch<{ event: AdminEvent }>(`/api/admin/events/${params.id}`);
      setEvent(event);
      const { participants } = await apiFetch<{ participants: Participant[] }>(
        `/api/admin/events/${params.id}/participants`,
      );
      setParticipants(participants);
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

      <h2 style={{ fontSize: 22, margin: "28px 0 12px" }}>
        Участники <span style={{ color: "var(--color-muted)", fontSize: 16 }}>· {participants.length}</span>
      </h2>
      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
              <th style={cell}>Имя</th>
              <th style={cell}>Telegram</th>
              <th style={cell}>Запись</th>
              <th style={cell}>Явка</th>
              <th style={cell}>Оплата</th>
              <th style={cell}>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.booking_id} style={{ borderTop: "1px solid var(--color-line)" }}>
                <td style={cell}>{p.display_name ?? "—"}</td>
                <td style={cell}>{p.telegram_username ? `@${p.telegram_username}` : "—"}</td>
                <td style={cell}>{p.booking_status}</td>
                <td style={cell}>{ATT_LABEL[p.attendance_status] ?? p.attendance_status}</td>
                <td style={cell}>{PAY_LABEL[p.payment_status] ?? p.payment_status}</td>
                <td style={cell}>{p.payment_amount != null ? `${p.payment_amount} ${event.currency}` : "—"}</td>
              </tr>
            ))}
            {participants.length === 0 && (
              <tr>
                <td style={cell} colSpan={6}>
                  Пока никто не записан.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12 }}>
        Отметка явки и оплат появится в Итерации 4.
      </p>
    </div>
  );
}

const cell: React.CSSProperties = { padding: "10px 12px" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", padding: "8px 0", borderBottom: "1px solid var(--color-line)" }}>
      <div style={{ color: "var(--color-graphite-600)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
