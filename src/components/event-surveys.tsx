"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, Button, inputStyle } from "@/components/ui";

type Survey = {
  id: string;
  question: string;
  answer_type: string;
  is_active: boolean;
  response_count: number;
  avg_value: number | null;
};
type Resp = { user_name: string; answer_value: number | null; answer_text: string | null };

// Опросы события (09/20): создать, отправить attended, посмотреть ответы.
export function EventSurveys({ eventId }: { eventId: string }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [question, setQuestion] = useState("Как тебе событие?");
  const [openId, setOpenId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<{ surveys: Survey[] }>(`/api/admin/surveys?event_id=${eventId}`).then((d) => setSurveys(d.surveys)).catch((e) => setError(e.message));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [eventId]);

  async function create() {
    setError(null); setInfo(null);
    try {
      await apiFetch("/api/admin/surveys", { method: "POST", body: JSON.stringify({ event_id: eventId, question, answer_type: "rating_1_5" }) });
      setInfo("Опрос создан");
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function send(id: string) {
    setError(null); setInfo(null);
    try {
      const r = await apiFetch<{ sent: number; recipients: number }>(`/api/admin/surveys/${id}/send`, { method: "POST", body: "{}" });
      setInfo(`Опрос отправлен: ${r.sent}/${r.recipients}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function viewResponses(id: string) {
    if (openId === id) { setOpenId(null); return; }
    const r = await apiFetch<{ responses: Resp[] }>(`/api/admin/surveys/${id}/responses`);
    setResponses(r.responses);
    setOpenId(id);
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, marginBottom: 10 }}>Опросы</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input style={{ ...inputStyle, flex: 1 }} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Button onClick={create} disabled={!question.trim()}>Создать опрос</Button>
      </div>
      {info && <p style={{ color: "var(--color-success)", fontSize: 13 }}>{info}</p>}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}

      {surveys.length === 0 && <p style={{ color: "var(--color-graphite-600)", margin: 0 }}>Опросов пока нет.</p>}
      {surveys.map((s) => (
        <div key={s.id} style={{ borderTop: "1px solid var(--color-line)", padding: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 14 }}>{s.question}</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                Ответов: {s.response_count}{s.avg_value != null ? ` · средняя ${s.avg_value}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="secondary" onClick={() => viewResponses(s.id)}>{openId === s.id ? "Скрыть" : "Ответы"}</Button>
              <Button variant="secondary" onClick={() => send(s.id)}>Отправить</Button>
            </div>
          </div>
          {openId === s.id && (
            <div style={{ marginTop: 8, paddingLeft: 12 }}>
              {responses.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Ответов нет.</div>}
              {responses.map((r, i) => (
                <div key={i} style={{ fontSize: 13, padding: "4px 0" }}>
                  <b>{r.user_name}</b>{r.answer_value != null ? ` · ${r.answer_value}/5` : ""}{r.answer_text ? ` — ${r.answer_text}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
