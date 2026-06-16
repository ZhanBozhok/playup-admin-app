"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, Card, Button, Field, inputStyle } from "@/components/ui";

type Venue = { id: string; name: string; address: string | null; defaultCost: string | null; status: string };

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<{ venues: Venue[] }>("/api/admin/venues").then((d) => setVenues(d.venues)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/admin/venues", {
        method: "POST",
        body: JSON.stringify({ name, address: address || undefined, default_cost: cost ? Number(cost) : undefined }),
      });
      setName(""); setAddress(""); setCost(""); setShow(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader title="Площадки" action={<Button onClick={() => setShow((s) => !s)}>{show ? "Скрыть" : "+ Площадка"}</Button>} />
      {show && (
        <Card style={{ marginBottom: 16 }}>
          <form onSubmit={create} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 12, alignItems: "end" }}>
            <Field label="Название"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Адрес"><input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Field label="Ст. цена"><input type="number" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Button type="submit">Добавить</Button>
          </form>
          {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
        </Card>
      )}
      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-graphite-600)", background: "var(--color-cream-50)" }}>
              <th style={c}>Название</th><th style={c}>Адрес</th><th style={c}>Ст. цена</th><th style={c}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                <td style={c}>{v.name}</td><td style={c}>{v.address ?? "—"}</td>
                <td style={c}>{v.defaultCost ?? "—"}</td><td style={c}>{v.status}</td>
              </tr>
            ))}
            {venues.length === 0 && <tr><td style={c} colSpan={4}>Площадок пока нет.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
const c: React.CSSProperties = { padding: "12px" };
