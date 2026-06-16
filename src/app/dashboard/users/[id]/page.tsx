"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle, LEVELS } from "@/components/ui";

type Detail = {
  user: {
    id: string;
    telegram_id: string | null;
    telegram_username: string | null;
    status: string;
    created_at: string;
    last_seen_at: string | null;
    profile: {
      display_name: string | null;
      phone: string | null;
      level: string | null;
      preferred_sports: string[];
      preferred_area: string | null;
      traffic_source: string | null;
    } | null;
  };
  metrics: {
    total_attended: number;
    total_no_show: number;
    total_bookings: number;
    total_paid: number;
    current_week_streak: number;
    favorite_activity: string | null;
  };
  bookings: {
    booking_id: string;
    booking_status: string;
    attendance_status: string;
    event: { id: string; title: string; activity_type: string; starts_at: string; status: string };
  }[];
  payments: { id: string; event_title: string | null; amount: number; currency: string; status: string }[];
  notes: { id: string; note: string; created_at: string }[];
  survey_responses: { question: string; event_title: string | null; answer_value: number | null; answer_text: string | null; created_at: string }[];
};

const fmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });
const fmtDT = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });
type Tab = "overview" | "events" | "payments" | "surveys" | "notes";

export default function UserCardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  function load() {
    apiFetch<Detail>(`/api/admin/users/${params.id}`).then(setData).catch((e) => setError(e.message));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [params.id]);

  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>;

  const { user, metrics } = data;
  const name = user.profile?.display_name ?? user.telegram_username ?? "Без имени";

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader
        title={name}
        action={<Link href="/dashboard/users"><Button variant="secondary">← К списку</Button></Link>}
      />

      {/* метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <Metric label="Посещений" value={metrics.total_attended} />
        <Metric label="Записей" value={metrics.total_bookings} />
        <Metric label="No-show" value={metrics.total_no_show} />
        <Metric label="Серия недель" value={metrics.current_week_streak} />
        <Metric label="Оплачено" value={metrics.total_paid} />
        <Metric label="Любимое" value={metrics.favorite_activity ?? "—"} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["overview", "events", "payments", "surveys", "notes"] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {{ overview: "Обзор", events: "События", payments: "Оплаты", surveys: "Опросы", notes: "Заметки" }[t]}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          {!editing ? (
            <>
              <Row label="Telegram ID" value={user.telegram_id ?? "—"} />
              <Row label="Telegram username" value={user.telegram_username ? `@${user.telegram_username}` : "—"} />
              <Row label="Имя" value={user.profile?.display_name ?? "—"} />
              <Row label="Телефон" value={user.profile?.phone ?? "—"} />
              <Row label="Уровень" value={user.profile?.level ?? "—"} />
              <Row label="Интересы" value={user.profile?.preferred_sports?.join(", ") || "—"} />
              <Row label="Район" value={user.profile?.preferred_area ?? "—"} />
              <Row label="Источник" value={user.profile?.traffic_source ?? "—"} />
              <Row label="Статус" value={user.status} />
              <Row label="Регистрация" value={fmt.format(new Date(user.created_at))} />
              <Row label="Последняя активность" value={user.last_seen_at ? fmtDT.format(new Date(user.last_seen_at)) : "—"} />
              <div style={{ marginTop: 16 }}>
                <Button variant="secondary" onClick={() => setEditing(true)}>Редактировать профиль</Button>
              </div>
            </>
          ) : (
            <EditProfile
              id={user.id}
              initial={user.profile}
              onDone={() => {
                setEditing(false);
                load();
              }}
            />
          )}
        </Card>
      )}

      {tab === "events" && (
        <Card style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
                <th style={c}>Событие</th><th style={c}>Дата</th><th style={c}>Запись</th><th style={c}>Явка</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((b) => (
                <tr key={b.booking_id} style={{ borderTop: "1px solid var(--color-line)" }}>
                  <td style={c}><Link href={`/dashboard/events/${b.event.id}`} style={{ color: "var(--color-green-800)" }}>{b.event.title}</Link></td>
                  <td style={c}>{fmt.format(new Date(b.event.starts_at))}</td>
                  <td style={c}>{b.booking_status}</td>
                  <td style={c}>{b.attendance_status}</td>
                </tr>
              ))}
              {data.bookings.length === 0 && <tr><td style={c} colSpan={4}>Записей нет.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "payments" && (
        <Card style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
                <th style={c}>Событие</th><th style={c}>Сумма</th><th style={c}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                  <td style={c}>{p.event_title ?? "—"}</td>
                  <td style={c}>{p.amount} {p.currency}</td>
                  <td style={c}>{p.status}</td>
                </tr>
              ))}
              {data.payments.length === 0 && <tr><td style={c} colSpan={3}>Оплат нет.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "surveys" && (
        <Card>
          {data.survey_responses.length === 0 && <p style={{ color: "var(--color-graphite-600)", margin: 0 }}>Ответов на опросы нет.</p>}
          {data.survey_responses.map((r, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-line)" }}>
              <div style={{ fontSize: 14 }}>
                {r.question}
                {r.answer_value != null ? ` — ${r.answer_value}/5` : ""}
              </div>
              {r.answer_text && <div style={{ fontSize: 13, color: "var(--color-graphite-600)", marginTop: 2 }}>«{r.answer_text}»</div>}
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{r.event_title ?? ""}</div>
            </div>
          ))}
        </Card>
      )}

      {tab === "notes" && <NotesTab id={user.id} notes={data.notes} onAdded={load} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--color-graphite-600)" }}>{label}</div>
      <div className="tabular" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "8px 0", borderBottom: "1px solid var(--color-line)" }}>
      <div style={{ color: "var(--color-graphite-600)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

function EditProfile({
  id,
  initial,
  onDone,
}: {
  id: string;
  initial: Detail["user"]["profile"];
  onDone: () => void;
}) {
  const [f, setF] = useState({
    display_name: initial?.display_name ?? "",
    phone: initial?.phone ?? "",
    level: initial?.level ?? "",
    preferred_area: initial?.preferred_area ?? "",
    traffic_source: initial?.traffic_source ?? "",
    preferred_sports: (initial?.preferred_sports ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/users/${id}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: f.display_name || null,
          phone: f.phone || null,
          level: f.level || null,
          preferred_area: f.preferred_area || null,
          traffic_source: f.traffic_source || null,
          preferred_sports: f.preferred_sports ? f.preferred_sports.split(",").map((s) => s.trim()).filter(Boolean) : [],
        }),
      });
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
      <Field label="Имя"><input style={inputStyle} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
      <Field label="Телефон"><input style={inputStyle} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Уровень">
        <select style={inputStyle} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          <option value="">—</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
      <Field label="Интересы (через запятую)"><input style={inputStyle} value={f.preferred_sports} onChange={(e) => setF({ ...f, preferred_sports: e.target.value })} /></Field>
      <Field label="Район"><input style={inputStyle} value={f.preferred_area} onChange={(e) => setF({ ...f, preferred_area: e.target.value })} /></Field>
      <Field label="Источник (можно править вручную)"><input style={inputStyle} value={f.traffic_source} onChange={(e) => setF({ ...f, traffic_source: e.target.value })} /></Field>
      {err && <div style={{ color: "var(--color-danger)", fontSize: 13 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Отмена</Button>
      </div>
    </form>
  );
}

function NotesTab({ id, notes, onAdded }: { id: string; notes: Detail["notes"]; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${id}/notes`, { method: "POST", body: JSON.stringify({ note: text }) });
      setText("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Заметка о пользователе" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={saving}>Добавить</Button>
      </form>
      {notes.length === 0 && <p style={{ color: "var(--color-graphite-600)", margin: 0 }}>Заметок пока нет.</p>}
      {notes.map((n) => (
        <div key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-line)" }}>
          <div style={{ fontSize: 14 }}>{n.note}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{fmtDT.format(new Date(n.created_at))}</div>
        </div>
      ))}
    </Card>
  );
}

const c: React.CSSProperties = { padding: "10px 12px" };
