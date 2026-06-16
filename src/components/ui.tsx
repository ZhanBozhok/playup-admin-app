"use client";

import React from "react";

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>{title}</h1>
      {action}
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const base: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: "var(--radius-md)",
    fontSize: 14,
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.6 : 1,
    border: "1px solid transparent",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--color-green-800)", color: "var(--color-cream-50)" },
    secondary: { background: "transparent", color: "var(--color-green-800)", borderColor: "var(--color-line)" },
    danger: { background: "transparent", color: "var(--color-danger)", borderColor: "var(--color-danger)" },
  };
  return (
    <button {...props} style={{ ...base, ...variants[variant], ...(props.style ?? {}) }}>
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--color-graphite-600)" }}>
      {label}
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--color-line)",
  borderRadius: "var(--radius-md)",
  fontSize: 14,
  background: "var(--color-cream-50)",
  width: "100%",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#ece6d8", fg: "var(--color-graphite-700)", label: "Черновик" },
  published: { bg: "#dceee2", fg: "var(--color-success)", label: "Опубликовано" },
  cancelled: { bg: "#f1ddd9", fg: "var(--color-danger)", label: "Отменено" },
  completed: { bg: "#e2e4dc", fg: "var(--color-olive-600, #6f7654)", label: "Завершено" },
};

const RISK_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  below_quorum: { bg: "#f1e3d4", fg: "var(--color-warning)", label: "Ниже кворума" },
  ok: { bg: "#dceee2", fg: "var(--color-success)", label: "Ок" },
  almost_full: { bg: "#f1e3d4", fg: "var(--color-warning)", label: "Почти заполнено" },
  full: { bg: "#e2e4dc", fg: "var(--color-graphite-700)", label: "Заполнено" },
  needs_closing: { bg: "#f1ddd9", fg: "var(--color-danger)", label: "Требует действия" },
};

export function Badge({ kind, value }: { kind: "status" | "risk"; value: string }) {
  const map = kind === "status" ? STATUS_COLORS : RISK_COLORS;
  const c = map[value] ?? { bg: "#eee", fg: "#555", label: value };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}

export const ACTIVITY_TYPES = ["football", "padel", "run", "yoga", "recovery", "social", "other"];
export const LEVELS = ["beginner", "amateur", "confident", "advanced", "mixed"];
