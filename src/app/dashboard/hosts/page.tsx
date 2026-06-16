"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle } from "@/components/ui";

type Host = { id: string; name: string; telegramUsername: string | null; defaultFee: string | null; status: string };

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [tg, setTg] = useState("");
  const [fee, setFee] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<{ hosts: Host[] }>("/api/admin/hosts").then((d) => setHosts(d.hosts)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/admin/hosts", {
        method: "POST",
        body: JSON.stringify({ name, telegram_username: tg || undefined, default_fee: fee ? Number(fee) : undefined }),
      });
      setName(""); setTg(""); setFee(""); setShow(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader title="Хосты" action={<Button onClick={() => setShow((s) => !s)}>{show ? "Скрыть" : "+ Хост"}</Button>} />
      {show && (
        <Card style={{ marginBottom: 16 }}>
          <form onSubmit={create} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 12, alignItems: "end" }}>
            <Field label="Имя"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Telegram"><input style={inputStyle} value={tg} onChange={(e) => setTg(e.target.value)} /></Field>
            <Field label="Ставка"><input type="number" style={inputStyle} value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
            <Button type="submit">Добавить</Button>
          </form>
          {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
        </Card>
      )}
      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
              <th style={c}>Имя</th><th style={c}>Telegram</th><th style={c}>Ставка</th><th style={c}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                <td style={c}>{h.name}</td><td style={c}>{h.telegramUsername ?? "—"}</td>
                <td style={c}>{h.defaultFee ?? "—"}</td><td style={c}>{h.status}</td>
              </tr>
            ))}
            {hosts.length === 0 && <tr><td style={c} colSpan={4}>Хостов пока нет.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
const c: React.CSSProperties = { padding: "12px" };
