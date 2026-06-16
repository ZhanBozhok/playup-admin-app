"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Меню админки — 15_admin_screens_detailed_spec.md
const NAV = [
  "Главная",
  "Пользователи",
  "Расписание",
  "Площадки",
  "Хосты",
  "Финансы",
  "Пуши и опросы",
  "Аналитика",
  "Настройки",
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [adminName, setAdminName] = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("playup_admin_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const a = JSON.parse(localStorage.getItem("playup_admin") || "{}");
      setAdminName(a?.name ?? "");
    } catch {
      /* ignore */
    }
  }, [router]);

  function logout() {
    localStorage.removeItem("playup_admin_token");
    localStorage.removeItem("playup_admin");
    router.replace("/login");
  }

  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.brand}>PlayUp</div>
        <nav style={S.nav}>
          {NAV.map((item, i) => (
            <a key={item} style={{ ...S.navItem, ...(i === 0 ? S.navItemActive : {}) }} href="#">
              {item}
            </a>
          ))}
        </nav>
        <button style={S.logout} onClick={logout}>
          Выйти{adminName ? ` · ${adminName}` : ""}
        </button>
      </aside>
      <main style={S.content}>{children}</main>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  shell: { display: "grid", gridTemplateColumns: "248px 1fr", minHeight: "100vh" },
  sidebar: {
    background: "var(--color-green-900)",
    color: "var(--color-cream-100)",
    padding: "var(--space-6) var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-5)",
  },
  brand: { fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600, padding: "0 var(--space-3)" },
  nav: { display: "flex", flexDirection: "column", gap: "var(--space-1)", flex: 1 },
  navItem: {
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    fontSize: 14,
    color: "var(--color-cream-200)",
  },
  navItemActive: { background: "var(--color-green-700)", color: "#fff" },
  logout: {
    background: "transparent",
    border: "1px solid var(--color-green-700)",
    color: "var(--color-cream-200)",
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
  },
  content: { padding: "var(--space-7)" },
};
