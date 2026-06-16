// HTTP-хелперы: единый формат ошибок (13) и защита admin-эндпоинтов (18).
import { NextResponse } from "next/server";
import { getAdminFromAuthHeader, type AdminTokenPayload } from "./auth";
import { prisma } from "./db";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_STATUS_TRANSITION";

export function errorResponse(code: ErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details: details ?? {} } }, { status });
}

/**
 * Проверяет admin-токен и активность админа (18). Возвращает payload либо
 * NextResponse с ошибкой — вызывающий код проверяет instanceof NextResponse.
 */
export async function requireAdmin(req: Request): Promise<AdminTokenPayload | NextResponse> {
  const payload = getAdminFromAuthHeader(req.headers.get("authorization"));
  if (!payload || payload.role === "client") {
    return errorResponse("UNAUTHORIZED", "Admin authorization required", 401);
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin || admin.status !== "active") {
    return errorResponse("FORBIDDEN", "Admin is not active", 403);
  }
  return payload;
}

export async function parseJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
