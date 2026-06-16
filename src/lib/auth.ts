// Авторизация админа (18_permissions_auth_roles.md): email/password -> JWT.
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "7d";

export type AdminTokenPayload = { sub: string; role: string; name: string };

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Проверяет email/password админа. Возвращает токен и публичные поля админа
 * либо null при неуспехе. Backend всегда проверяет active status (18).
 */
export async function loginAdmin(email: string, password: string) {
  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!admin || admin.status !== "active" || !admin.passwordHash) return null;

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return null;

  const token = signAdminToken({ sub: admin.id, role: admin.role, name: admin.name });
  return { token, admin: { id: admin.id, name: admin.name, role: admin.role } };
}

/** Достаёт админа из Authorization: Bearer <token>. Для защиты admin endpoints. */
export function getAdminFromAuthHeader(authHeader: string | null): AdminTokenPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyAdminToken(authHeader.slice("Bearer ".length).trim());
}
