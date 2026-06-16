"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@playup.club");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Не удалось войти");
        return;
      }
      localStorage.setItem("playup_admin_token", data.token);
      localStorage.setItem("playup_admin", JSON.stringify(data.admin));
      router.push("/dashboard");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <div style={S.brand}>PlayUp</div>
        <h1 style={S.title}>Вход в админку</h1>
        <form onSubmit={onSubmit} style={S.form}>
          <label style={S.label}>
            Email
            <input style={S.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label style={S.label}>
            Пароль
            <input
              style={S.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div style={S.error}>{error}</div>}
          <button style={S.button} type="submit" disabled={loading}>
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", padding: "var(--space-5)" },
  card: {
    width: 380,
    maxWidth: "100%",
    background: "#fff",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-soft)",
    padding: "var(--space-7)",
  },
  brand: { fontFamily: "var(--font-heading)", color: "var(--color-green-800)", fontSize: 22, fontWeight: 600 },
  title: { fontSize: 28, margin: "var(--space-2) 0 var(--space-5)" },
  form: { display: "flex", flexDirection: "column", gap: "var(--space-4)" },
  label: { display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: 13, color: "var(--color-graphite-600)" },
  input: {
    padding: "12px 14px",
    border: "1px solid var(--color-line)",
    borderRadius: "var(--radius-md)",
    fontSize: 14,
    background: "var(--color-cream-50)",
  },
  error: { color: "var(--color-danger)", fontSize: 13 },
  button: {
    marginTop: "var(--space-2)",
    padding: "13px 16px",
    border: "none",
    borderRadius: "var(--radius-md)",
    background: "var(--color-green-800)",
    color: "var(--color-cream-50)",
    fontSize: 15,
    cursor: "pointer",
  },
};
