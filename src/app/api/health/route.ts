// GET /api/health — проверка, что backend и БД живы.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch (e) {
    return NextResponse.json({ status: "error", db: "down" }, { status: 500 });
  }
}
