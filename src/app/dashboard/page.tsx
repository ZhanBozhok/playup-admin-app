"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Badge } from "@/components/ui";

type Dashboard = {
  upcoming_events: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string | null;
    host_name: string | null;
    capacity: number;
    booked_count: number;
    min_quorum: number | null;
    risk_status: string;
    expected_revenue: number;
    needs_closing: boolean;
  }[];
  actions: { type: string; event_id: string; label: string }[];
  metrics: {
    revenue_today: number;
    revenue_week: number;
    expenses_week: number;
    profit_week: number;
    new_users_week: number;
    first_time_attendees_week: number;
    repeat_attendees_week: number;
    active_users_30d: number;
    no_show_rate_week: number;
    unpaid_amount: number;
  };
  cashboxes: { id: string; name: string; currency: string; balance: number }[];
};

const fmtDT = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function DashboardHome() {
  const router = useRouter();
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>("/api/admin/dashboard").then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!d) return <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>;

  const m = d.metrics;
  return (
    <div>
      <PageHeader title="Главная" />

      {/* Деньги/люди недели */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Доход сегодня" value={`${m.revenue_today}`} />
        <Metric label="Доход за неделю" value={`${m.revenue_week}`} />
        <Metric label="Расход за неделю" value={`${m.expenses_week}`} />
        <Metric label="Прибыль за неделю" value={`${m.profit_week}`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <Metric label="Новые за неделю" value={`${m.new_users_week}`} />
        <Metric label="Пришли впервые" value={`${m.first_time_attendees_week}`} />
        <Metric label="Пришли повторно" value={`${m.repeat_attendees_week}`} />
        <Metric label="Активные 30д" value={`${m.active_users_30d}`} />
        <Metric label="No-show неделя" value={`${Math.round(m.no_show_rate_week * 100)}%`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Ближайшие события */}
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>Ближайшие события</h2>
          <Card style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
              <thead>
                <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
                  <th style={c}>Когда</th><th style={c}>Событие</th><th style={c}>Записи</th>
                  <th style={c}>Ожид. выручка</th><th style={c}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {d.upcoming_events.map((e) => (
                  <tr key={e.id} onClick={() => router.push(`/dashboard/events/${e.id}`)} style={{ borderTop: "1px solid var(--color-line)", cursor: "pointer" }}>
                    <td style={c}>{fmtDT.format(new Date(e.starts_at))}</td>
                    <td style={c}>{e.title}<div style={{ color: "var(--color-muted)", fontSize: 12 }}>{e.venue_name ?? ""}</div></td>
                    <td style={c}>{e.booked_count}/{e.capacity}{e.min_quorum != null ? ` · кв.${e.min_quorum}` : ""}</td>
                    <td style={c}>{e.expected_revenue}</td>
                    <td style={c}><Badge kind="risk" value={e.risk_status} /></td>
                  </tr>
                ))}
                {d.upcoming_events.length === 0 && (
                  <tr><td style={c} colSpan={5}>Нет опубликованных событий. <a href="/dashboard/events/new" style={{ color: "var(--color-green-800)" }}>Создать</a></td></tr>
                )}
              </tbody>
            </table>
          </Card>

          {/* Балансы касс */}
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            {d.cashboxes.map((cb) => (
              <div key={cb.id} style={{ background: "var(--color-green-900)", color: "var(--color-cream-50)", borderRadius: "var(--radius-md)", padding: "10px 16px" }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{cb.name}</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>{cb.balance} {cb.currency}</div>
              </div>
            ))}
            <div style={{ background: "var(--color-cream-100)", borderRadius: "var(--radius-md)", padding: "10px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-graphite-600)" }}>Неоплачено</div>
              <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>{m.unpaid_amount}</div>
            </div>
          </div>
        </div>

        {/* Действия */}
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>Нужно сделать</h2>
          <Card>
            {d.actions.length === 0 && <p style={{ color: "var(--color-graphite-600)", margin: 0 }}>Всё под контролем 👌</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.actions.map((a, i) => (
                <div
                  key={i}
                  onClick={() => router.push(`/dashboard/events/${a.event_id}`)}
                  style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: "var(--radius-md)", background: "var(--color-cream-50)", cursor: "pointer" }}
                >
                  <ActionDot type={a.type} />
                  <span style={{ fontSize: 13 }}>{a.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionDot({ type }: { type: string }) {
  const color =
    type === "below_quorum" || type === "needs_closing" || type === "complete_event"
      ? "var(--color-danger)"
      : type === "unpaid_participants"
      ? "var(--color-warning)"
      : "var(--color-muted)";
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--color-graphite-600)" }}>{label}</div>
      <div className="tabular" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const c: React.CSSProperties = { padding: "10px 12px" };
