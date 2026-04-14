import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;
    return NextResponse.json({ status: "ok", db: "connected", ms }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    const ms = Date.now() - start;
    return NextResponse.json({ status: "error", db: "unreachable", ms }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
