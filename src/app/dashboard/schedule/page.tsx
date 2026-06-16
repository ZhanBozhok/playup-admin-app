"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Badge } from "@/components/ui";

type AdminEvent = {
  id: string;
  title: string;
  activity_type: string;
  starts_at: string;
  ends_at: string;
  venue: { id: string; name: string } | null;
  host: { id: string; name: string } | null;
  capacity: number;
  booked_count: number;
  status: string;
  risk_status: string;
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // понедельник = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
const fmtDay = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const fmtDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function SchedulePage() {
  const router = useRouter();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [view, setView] = useState<"week" | "list">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ events: AdminEvent[] }>("/api/admin/events")
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)),
    [weekStart],
  );

  function eventsForDay(day: Date): AdminEvent[] {
    return events
      .filter((e) => {
        const s = new Date(e.starts_at);
        return s.toDateString() === day.toDateString();
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  return (
    <div>
      <PageHeader
        title="Расписание"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant={view === "week" ? "primary" : "secondary"} onClick={() => setView("week")}>
              Календарь
            </Button>
            <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>
              Список
            </Button>
            <Link href="/dashboard/events/new">
              <Button>+ Создать событие</Button>
            </Link>
          </div>
        }
      />

      {loading && <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!loading && !error && view === "week" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Button variant="secondary" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}>
              ←
            </Button>
            <span style={{ color: "var(--color-graphite-600)" }}>
              {fmtDate.format(days[0])} — {fmtDate.format(days[6])}
            </span>
            <Button variant="secondary" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}>
              →
            </Button>
            <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Сегодня
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {days.map((day) => (
              <div key={day.toISOString()} style={{ minHeight: 160 }}>
                <div style={{ fontSize: 12, color: "var(--color-graphite-600)", marginBottom: 8 }}>
                  {fmtDay.format(day)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {eventsForDay(day).map((e) => (
                    <div
                      key={e.id}
                      onClick={() => router.push(`/dashboard/events/${e.id}`)}
                      style={{
                        background: "#fff",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-card)",
                        padding: 10,
                        cursor: "pointer",
                        borderLeft: "3px solid var(--color-green-700)",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--color-graphite-600)" }}>{fmtTime.format(new Date(e.starts_at))}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, margin: "2px 0 6px" }}>{e.title}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Badge kind="status" value={e.status} />
                      </div>
                    </div>
                  ))}
                  <Link
                    href={`/dashboard/events/new?date=${day.toISOString().slice(0, 10)}`}
                    style={{ fontSize: 12, color: "var(--color-muted)", padding: "4px 0" }}
                  >
                    + слот
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !error && view === "list" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
                <th style={th}>Дата</th>
                <th style={th}>Время</th>
                <th style={th}>Название</th>
                <th style={th}>Активность</th>
                <th style={th}>Площадка</th>
                <th style={th}>Хост</th>
                <th style={th}>Записи</th>
                <th style={th}>Статус</th>
                <th style={th}>Риск</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => router.push(`/dashboard/events/${e.id}`)}
                  style={{ borderTop: "1px solid var(--color-line)", cursor: "pointer" }}
                >
                  <td style={td}>{fmtDate.format(new Date(e.starts_at))}</td>
                  <td style={td}>{fmtTime.format(new Date(e.starts_at))}</td>
                  <td style={td}>{e.title}</td>
                  <td style={td}>{e.activity_type}</td>
                  <td style={td}>{e.venue?.name ?? "—"}</td>
                  <td style={td}>{e.host?.name ?? "—"}</td>
                  <td style={td}>
                    {e.booked_count}/{e.capacity}
                  </td>
                  <td style={td}>
                    <Badge kind="status" value={e.status} />
                  </td>
                  <td style={td}>{e.status === "published" ? <Badge kind="risk" value={e.risk_status} /> : "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td style={td} colSpan={9}>
                    Событий пока нет. Создай первое.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px" };
