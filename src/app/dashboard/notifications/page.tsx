"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle, ACTIVITY_TYPES } from "@/components/ui";

type EventRef = { id: string; title: string };
type Notif = {
  id: string;
  type: string;
  status: string;
  target_type: string;
  event_title: string | null;
  message: string;
  recipients: number;
  sent: number;
  failed: number;
  created_at: string;
};

const SEGMENTS: [string, string][] = [
  ["event_participants", "Участники события"],
  ["event_attended", "Пришедшие на событие"],
  ["event_no_show", "No-show на событии"],
  ["all_users", "Все пользователи"],
  ["new_users", "Новые за неделю"],
  ["active_users", "Активные (30д)"],
  ["sleeping_users", "Спящие"],
  ["activity_type", "По активности"],
  ["traffic_source", "По источнику"],
];
const SOURCES = ["instagram", "threads", "telegram_chat", "friend", "host_invite", "ads", "offline", "other"];
const fmtDT = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export default function NotificationsPage() {
  const [events, setEvents] = useState<EventRef[]>([]);
  const [history, setHistory] = useState<Notif[]>([]);
  const [target, setTarget] = useState("event_participants");
  const [eventId, setEventId] = useState("");
  const [activity, setActivity] = useState("football");
  const [source, setSource] = useState("instagram");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsEvent = target.startsWith("event_");
  const needsActivity = target === "activity_type";
  const needsSource = target === "traffic_source";

  function buildFilter() {
    const f: Record<string, string> = {};
    if (needsEvent && eventId) f.event_id = eventId;
    if (needsActivity) f.activity_type = activity;
    if (needsSource) f.traffic_source = source;
    return f;
  }

  function loadHistory() {
    apiFetch<{ notifications: Notif[] }>("/api/admin/notifications").then((d) => setHistory(d.notifications)).catch(() => {});
  }
  useEffect(() => {
    apiFetch<{ events: EventRef[] }>("/api/admin/events").then((d) => setEvents(d.events)).catch(() => {});
    loadHistory();
  }, []);

  async function doPreview() {
    setError(null);
    setInfo(null);
    try {
      const r = await apiFetch<{ count: number; sample: string[] }>("/api/admin/notifications/preview", {
        method: "POST",
        body: JSON.stringify({ target_type: target, target_filter: buildFilter() }),
      });
      setPreview(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function send() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const r = await apiFetch<{ recipients: number; sent: number; failed: number }>("/api/admin/notifications/send", {
        method: "POST",
        body: JSON.stringify({
          target_type: target,
          target_filter: buildFilter(),
          event_id: needsEvent ? eventId || null : null,
          message,
        }),
      });
      setInfo(`Отправлено: ${r.sent} из ${r.recipients}${r.failed ? `, ошибок ${r.failed}` : ""}`);
      setMessage("");
      setPreview(null);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader title="Пуши и опросы" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, marginBottom: 12 }}>Ручная отправка</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Сегмент">
            <select style={inputStyle} value={target} onChange={(e) => { setTarget(e.target.value); setPreview(null); }}>
              {SEGMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {needsEvent && (
            <Field label="Событие">
              <select style={inputStyle} value={eventId} onChange={(e) => { setEventId(e.target.value); setPreview(null); }}>
                <option value="">— выбрать —</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </Field>
          )}
          {needsActivity && (
            <Field label="Активность">
              <select style={inputStyle} value={activity} onChange={(e) => { setActivity(e.target.value); setPreview(null); }}>
                {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          )}
          {needsSource && (
            <Field label="Источник">
              <select style={inputStyle} value={source} onChange={(e) => { setSource(e.target.value); setPreview(null); }}>
                {SOURCES.map((srcv) => <option key={srcv} value={srcv}>{srcv}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Field label="Текст сообщения (можно {{user_name}}, {{event_title}}, {{event_time}}…)">
          <textarea style={{ ...inputStyle, minHeight: 100 }} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>

        {preview && (
          <div style={{ marginTop: 12, padding: 12, background: "var(--color-cream-50)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 14 }}>Получателей: <b>{preview.count}</b></div>
            {preview.count === 0 && <div style={{ color: "var(--color-warning)", fontSize: 13 }}>Нет получателей — отправлять некому.</div>}
            {preview.sample.length > 0 && (
              <div style={{ fontSize: 13, color: "var(--color-graphite-600)", marginTop: 4 }}>
                Первые: {preview.sample.join(", ")}
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
        {info && <p style={{ color: "var(--color-success)", fontSize: 13 }}>{info}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button variant="secondary" onClick={doPreview} disabled={needsEvent && !eventId}>Предпросмотр получателей</Button>
          <Button onClick={send} disabled={busy || !message.trim() || (needsEvent && !eventId)}>
            {busy ? "Отправляем…" : "Отправить"}
          </Button>
        </div>
      </Card>

      <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>История отправок</h2>
      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
              <th style={c}>Когда</th><th style={c}>Тип</th><th style={c}>Сегмент</th><th style={c}>Событие</th>
              <th style={c}>Текст</th><th style={c}>Получатели</th><th style={c}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {history.map((n) => (
              <tr key={n.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                <td style={c}>{fmtDT.format(new Date(n.created_at))}</td>
                <td style={c}>{n.type}</td>
                <td style={c}>{n.target_type}</td>
                <td style={c}>{n.event_title ?? "—"}</td>
                <td style={{ ...c, maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</td>
                <td style={c}>{n.sent}/{n.recipients}{n.failed ? ` (✗${n.failed})` : ""}</td>
                <td style={c}>{n.status}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td style={c} colSpan={7}>Отправок пока нет.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const c: React.CSSProperties = { padding: "10px 12px" };
