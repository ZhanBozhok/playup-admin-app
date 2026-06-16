// Telegram mini app auth (13_api_contracts_mvp.md, 17 Flow 1, 18).
// Валидация init data по спецификации Telegram WebApp + find-or-create User по telegram_id.
import crypto from "crypto";
import { prisma } from "./db";

export type TelegramUser = { id: string; username?: string | null };

/**
 * Проверяет подпись Telegram init data и возвращает пользователя.
 * Спецификация: secret = HMAC_SHA256(key="WebAppData", msg=bot_token);
 * проверочная строка — отсортированные "key=value" (кроме hash), join "\n".
 */
export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;
  return parseUserParam(params.get("user"));
}

function parseUserParam(userJson: string | null): TelegramUser | null {
  if (!userJson) return null;
  try {
    const u = JSON.parse(userJson);
    if (!u?.id) return null;
    return { id: String(u.id), username: u.username ?? null };
  } catch {
    return null;
  }
}

/**
 * Достаёт пользователя из init data с учётом dev-режима.
 * Прод: строгая проверка подписи (нужен TELEGRAM_BOT_TOKEN).
 * Dev (TELEGRAM_AUTH_DEV=true и NODE_ENV != production): доверяем user из init data
 * без криптопроверки — чтобы запускать клиент локально без реального бота.
 */
export function resolveTelegramUser(initData: string): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const devMode = process.env.TELEGRAM_AUTH_DEV === "true" && process.env.NODE_ENV !== "production";

  if (botToken) {
    const verified = validateInitData(initData, botToken);
    if (verified) return verified;
    if (!devMode) return null;
  }
  if (devMode) {
    // без подписи — просто парсим user param
    return parseUserParam(new URLSearchParams(initData).get("user"));
  }
  return null;
}

/** find-or-create по telegram_id (17 Flow 1). telegram_id — главный ключ, не username. */
export async function findOrCreateUser(tg: TelegramUser) {
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { telegramId: tg.id },
    update: { telegramUsername: tg.username ?? undefined, lastSeenAt: now },
    create: { telegramId: tg.id, telegramUsername: tg.username ?? undefined, status: "new", lastSeenAt: now },
    include: { profile: true },
  });
  return user;
}
