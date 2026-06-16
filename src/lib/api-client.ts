"use client";

// Клиентский fetch для админки: подставляет Bearer-токен, на 401/403 — выкидывает на логин.
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("playup_admin_token");
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("playup_admin_token");
      localStorage.removeItem("playup_admin");
      window.location.href = "/login";
    }
    throw new Error("UNAUTHORIZED");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Ошибка запроса");
  }
  return data as T;
}
