"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

// Меню админки — 15_admin_screens_detailed_spec.md. href=null — раздел появится позже.
const NAV: { label: string; href: string | null }[] = [
  { label: "Главная", href: "/dashboard" },
  { label: "Пользователи", href: "/dashboard/users" },
  { label: "Расписание", href: "/dashboard/schedule" },
  { label: "Площадки", href: "/dashboard/venues" },
  { label: "Хосты", href: "/dashboard/hosts" },
  { label: "Финансы", href: "/dashboard/finance" },
  { label: "Пуши и опросы", href: null },
  { label: "Аналитика", href: null },
  { label: "Настройки", href: null },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  function isActive(href: string | null): boolean {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.brand}>PlayUp</div>
        <nav style={S.nav}>
          {NAV.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                style={{ ...S.navItem, ...(isActive(item.href) ? S.navItemActive : {}) }}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} style={{ ...S.navItem, ...S.navItemDisabled }}>
                {item.label}
              </span>
            ),
          )}
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
  navItem: { padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--color-cream-200)" },
  navItemActive: { background: "var(--color-green-700)", color: "#fff" },
  navItemDisabled: { color: "rgba(239,230,214,0.4)", cursor: "default" },
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
