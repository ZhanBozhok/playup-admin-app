"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api-client";
import { PageHeader, Card, Button } from "@/components/ui";

const EXPORTS: [string, string][] = [
  ["users.csv", "Пользователи"],
  ["events.csv", "События"],
  ["bookings.csv", "Записи"],
  ["attendance.csv", "Посещаемость"],
  ["payments.csv", "Оплаты"],
  ["transactions.csv", "Транзакции"],
  ["survey_responses.csv", "Ответы на опросы"],
];

type DQ = { checks: { check: string; count: number; ok: boolean }[]; all_ok: boolean };

export default function SettingsPage() {
  const [dq, setDq] = useState<DQ | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DQ>("/api/admin/data-quality").then(setDq).catch((e) => setError(e.message));
  }, []);

  async function download(resource: string) {
    setDownloading(resource);
    setError(null);
    try {
      const res = await fetch(`/api/admin/export/${resource}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Не удалось выгрузить");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resource;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader title="Настройки" />

      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>Экспорт данных (CSV)</h2>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {EXPORTS.map(([file, label]) => (
            <Button key={file} variant="secondary" onClick={() => download(file)} disabled={downloading === file}>
              {downloading === file ? "Готовим…" : `↓ ${label}`}
            </Button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, marginBottom: 0 }}>
          Файлы открываются в Excel/Google Sheets (UTF-8, кириллица поддерживается).
        </p>
      </Card>

      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>Качество данных</h2>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {dq && (
        <Card style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {dq.checks.map((c) => (
                <tr key={c.check} style={{ borderTop: "1px solid var(--color-line)" }}>
                  <td style={{ padding: "10px 12px" }}>{c.check}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {c.ok ? (
                      <span style={{ color: "var(--color-success)" }}>✓ ок</span>
                    ) : (
                      <span style={{ color: "var(--color-danger)" }}>✗ {c.count}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {dq && (
        <p style={{ fontSize: 13, color: dq.all_ok ? "var(--color-success)" : "var(--color-danger)", marginTop: 12 }}>
          {dq.all_ok ? "Все проверки пройдены." : "Есть нарушения — проверь данные."}
        </p>
      )}
    </div>
  );
}
