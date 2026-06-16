// POST /api/client/auth/telegram — 13_api_contracts_mvp.md, 17 Flow 1
import { NextResponse } from "next/server";
import { z } from "zod";
import { signAdminToken } from "@/lib/auth";
import { resolveTelegramUser, findOrCreateUser } from "@/lib/telegram";

const Body = z.object({ init_data: z.string().min(1) });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "init_data required" } },
      { status: 400 },
    );
  }

  const tg = resolveTelegramUser(parsed.data.init_data);
  if (!tg) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid Telegram init data" } },
      { status: 401 },
    );
  }

  const user = await findOrCreateUser(tg);

  // В Итерации 0 переиспользуем JWT-подпись; отдельный client-токен — деталь позже.
  const token = signAdminToken({ sub: user.id, role: "client", name: user.telegramUsername ?? "client" });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      telegram_username: user.telegramUsername,
      profile_completed: Boolean(user.profile?.profileCompletedAt),
    },
  });
}
