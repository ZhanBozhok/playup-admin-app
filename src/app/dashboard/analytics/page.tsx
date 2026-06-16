"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Field, inputStyle } from "@/components/ui";

type Analytics = {
  period: { from: string; to: string };
  overview: {
    events: number; published: number; cancelled: number; completed: number;
    bookings: number; attended: number; no_show: number;
    attendance_rate: number; no_show_rate: number; payment_rate: number; fill_rate: number;
    revenue: number; expenses: number; profit: number; avg_check: number; new_users: number;
  };
  events_per_week: { week: string; count: number }[];
  by_activity: { activity_type: string; events: number; attended: number; revenue: number; profit: number; fill_rate: number }[];
  by_venue: { venue: string; events: number; revenue: number; expenses: number; profit: number }[];
  by_host: { host: string; events: number; attended: number; avg_rating: number | null }[];
  by_source: { source: string; users: number; first_attendees: number }[];
  users_by_status: Record<string, number>;
  retention: { first_visit_users: number; second_visit_rate: number; third_visit_rate: number; weekly_active_attendees: number };
};

function firstOfPeriod() {
  const d = new Date(Date.now() - 90 * 86400000);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [from, setFrom] = useState(firstOfPeriod());
  const [to, setTo] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Analytics>(`/api/admin/analytics?from=${from}&to=${to}`).then(setData).catch((e) => setError(e.message));
  }, [from, to]);
  useEffect(load, [load]);

  return (
    <div>
      <PageHeader title="Аналитика" />
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "end" }}>
        <Field label="С"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="По"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!data && !error && <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>}

      {data && (
        <>
          {/* Overview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
            <Metric label="События" value={`${data.overview.events}`} sub={`опубл. ${data.overview.published} · отм. ${data.overview.cancelled}`} />
            <Metric label="Записи" value={`${data.overview.bookings}`} />
            <Metric label="Пришли" value={`${data.overview.attended}`} sub={`посещаемость ${pct(data.overview.attendance_rate)}`} />
            <Metric label="No-show" value={`${data.overview.no_show}`} sub={pct(data.overview.no_show_rate)} />
            <Metric label="Заполняемость" value={pct(data.overview.fill_rate)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
            <Metric label="Выручка" value={`${data.overview.revenue}`} />
            <Metric label="Расходы" value={`${data.overview.expenses}`} />
            <Metric label="Прибыль" value={`${data.overview.profit}`} />
            <Metric label="Средний чек" value={`${data.overview.avg_check}`} />
            <Metric label="Новые пользователи" value={`${data.overview.new_users}`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Retention */}
            <Section title="Повторные визиты">
              <Line label="Пришли хотя бы раз" value={`${data.retention.first_visit_users}`} />
              <Line label="Вернулись 2-й раз" value={pct(data.retention.second_visit_rate)} />
              <Line label="Вернулись 3-й раз" value={pct(data.retention.third_visit_rate)} />
              <Line label="Активны на этой неделе" value={`${data.retention.weekly_active_attendees}`} />
            </Section>

            {/* Users by status */}
            <Section title="Пользователи по статусу">
              <Line label="Новые" value={`${data.users_by_status.new ?? 0}`} />
              <Line label="Активные" value={`${data.users_by_status.active ?? 0}`} />
              <Line label="Спящие" value={`${data.users_by_status.sleeping ?? 0}`} />
              <Line label="Заблокированные" value={`${data.users_by_status.blocked ?? 0}`} />
            </Section>
          </div>

          <Breakdown title="По активности" cols={["Активность", "События", "Пришли", "Заполн.", "Выручка", "Прибыль"]}
            rows={data.by_activity.map((r) => [r.activity_type, r.events, r.attended, pct(r.fill_rate), r.revenue, r.profit])} />
          <Breakdown title="По площадкам" cols={["Площадка", "События", "Выручка", "Расходы", "Прибыль"]}
            rows={data.by_venue.map((r) => [r.venue, r.events, r.revenue, r.expenses, r.profit])} />
          <Breakdown title="По хостам" cols={["Хост", "События", "Пришли", "Ср. оценка"]}
            rows={data.by_host.map((r) => [r.host, r.events, r.attended, r.avg_rating ?? "—"])} />
          <Breakdown title="По источникам привлечения" cols={["Источник", "Пользователи", "Из них пришли впервые"]}
            rows={data.by_source.map((r) => [r.source, r.users, r.first_attendees])} />

          <Section title="События по неделям">
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", height: 120, padding: "8px 0" }}>
              {data.events_per_week.length === 0 && <span style={{ color: "var(--color-graphite-600)" }}>Нет данных</span>}
              {data.events_per_week.map((w) => {
                const max = Math.max(...data.events_per_week.map((x) => x.count), 1);
                return (
                  <div key={w.week} style={{ textAlign: "center", flex: "0 0 auto" }}>
                    <div style={{ width: 28, height: `${(w.count / max) * 90}px`, background: "var(--color-green-700)", borderRadius: 6, marginBottom: 4 }} title={`${w.count}`} />
                    <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{w.week.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--color-graphite-600)" }}>{label}</div>
      <div className="tabular" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>{title}</h2>
      <Card>{children}</Card>
    </div>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-line)" }}>
      <span style={{ color: "var(--color-graphite-600)", fontSize: 14 }}>{label}</span>
      <span className="tabular" style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
function Breakdown({ title, cols, rows }: { title: string; cols: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>{title}</h2>
      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
              {cols.map((c) => <th key={c} style={cell}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-line)" }}>
                {r.map((v, j) => <td key={j} style={cell}>{v}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={cell} colSpan={cols.length}>Нет данных за период.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
const cell: React.CSSProperties = { padding: "10px 12px" };
