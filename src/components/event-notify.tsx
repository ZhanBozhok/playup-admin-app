"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, Button, inputStyle } from "@/components/ui";

// Быстрая коммуникация по событию (09/20): сообщение участникам + напоминания.
export function EventNotify({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, label: string) {
    setBusy(true);
    setInfo(null);
    setError(null);
    try {
      const r = await apiFetch<{ recipients: number; sent: number; failed: number }>("/api/admin/notifications/send", {
        method: "POST",
        body: JSON.stringify({ target_type: "event_participants", event_id: eventId, ...body }),
      });
      setInfo(`${label}: отправлено ${r.sent} из ${r.recipients}${r.failed ? `, ошибок ${r.failed}` : ""}`);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, marginBottom: 10 }}>Сообщения участникам</div>
      <textarea
        style={{ ...inputStyle, minHeight: 70, marginBottom: 10 }}
        placeholder="Текст сообщения участникам…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={() => send({ message }, "Сообщение")} disabled={busy || !message.trim()}>Отправить участникам</Button>
        <Button variant="secondary" onClick={() => send({ type: "event_reminder_24h" }, "Напоминание 24ч")} disabled={busy}>Напоминание за 24ч</Button>
        <Button variant="secondary" onClick={() => send({ type: "event_reminder_3h" }, "Напоминание 3ч")} disabled={busy}>Напоминание за 3ч</Button>
      </div>
      {info && <p style={{ color: "var(--color-success)", fontSize: 13, marginBottom: 0 }}>{info}</p>}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 0 }}>{error}</p>}
    </Card>
  );
}
