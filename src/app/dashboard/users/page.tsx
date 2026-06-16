"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Badge, inputStyle, ACTIVITY_TYPES, LEVELS } from "@/components/ui";

type UserRow = {
  id: string;
  telegram_username: string | null;
  display_name: string | null;
  level: string | null;
  preferred_sports: string[];
  traffic_source: string | null;
  status: string;
  attended: number;
  no_show: number;
  total_bookings: number;
  last_seen_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: "#ece6d8", fg: "var(--color-graphite-700)", label: "Новый" },
  active: { bg: "#dceee2", fg: "var(--color-success)", label: "Активный" },
  sleeping: { bg: "#f1e3d4", fg: "var(--color-warning)", label: "Спящий" },
  blocked: { bg: "#f1ddd9", fg: "var(--color-danger)", label: "Заблокирован" },
};
const fmtDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
const SOURCES = ["instagram", "threads", "telegram_chat", "friend", "host_invite", "ads", "offline", "other"];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [activity, setActivity] = useState("");
  const [hasNoShow, setHasNoShow] = useState(false);

  function load() {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    if (level) p.set("level", level);
    if (source) p.set("source", source);
    if (activity) p.set("activity_type", activity);
    if (hasNoShow) p.set("has_no_show", "true");
    apiFetch<{ users: UserRow[] }>(`/api/admin/users?${p.toString()}`)
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [status, level, source, activity, hasNoShow]);

  return (
    <div>
      <PageHeader title="Пользователи" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            style={{ flex: "1 1 240px" }}
          >
            <input
              style={inputStyle}
              placeholder="Поиск: имя, Telegram, телефон"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <select style={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="new">Новые</option>
            <option value="active">Активные</option>
            <option value="sleeping">Спящие</option>
            <option value="blocked">Заблокированные</option>
          </select>
          <select style={sel} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Все уровни</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select style={sel} value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">Все активности</option>
            {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select style={sel} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Все источники</option>
            {SOURCES.map((srcv) => <option key={srcv} value={srcv}>{srcv}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-graphite-600)" }}>
            <input type="checkbox" checked={hasNoShow} onChange={(e) => setHasNoShow(e.target.checked)} /> есть no-show
          </label>
        </div>
      </Card>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--color-graphite-600)" }}>Загрузка…</p>}

      {!loading && (
        <Card style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="tabular">
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
                <th style={c}>Имя</th>
                <th style={c}>Telegram</th>
                <th style={c}>Статус</th>
                <th style={c}>Уровень</th>
                <th style={c}>Источник</th>
                <th style={c}>Посещений</th>
                <th style={c}>No-show</th>
                <th style={c}>Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sc = STATUS_LABEL[u.status] ?? { bg: "#eee", fg: "#555", label: u.status };
                return (
                  <tr key={u.id} onClick={() => router.push(`/dashboard/users/${u.id}`)} style={{ borderTop: "1px solid var(--color-line)", cursor: "pointer" }}>
                    <td style={c}>{u.display_name ?? "—"}</td>
                    <td style={c}>{u.telegram_username ? `@${u.telegram_username}` : "—"}</td>
                    <td style={c}><span style={{ background: sc.bg, color: sc.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>{sc.label}</span></td>
                    <td style={c}>{u.level ?? "—"}</td>
                    <td style={c}>{u.traffic_source ?? "—"}</td>
                    <td style={c}>{u.attended}</td>
                    <td style={c}>{u.no_show}</td>
                    <td style={c}>{fmtDate.format(new Date(u.created_at))}</td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td style={c} colSpan={8}>Пользователи не найдены.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const c: React.CSSProperties = { padding: "12px" };
const sel: React.CSSProperties = { ...inputStyle, width: "auto", padding: "8px 10px" };
