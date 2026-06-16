// POST /api/admin/auth/login — 13_api_contracts_mvp.md
import { NextResponse } from "next/server";
import { z } from "zod";
import { loginAdmin } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

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
      { error: { code: "VALIDATION_ERROR", message: "email and password required" } },
      { status: 400 },
    );
  }

  const result = await loginAdmin(parsed.data.email, parsed.data.password);
  if (!result) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }, { status: 401 });
  }

  return NextResponse.json(result);
}
