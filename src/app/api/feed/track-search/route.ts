import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = (body?.query ?? "").trim().slice(0, 200);
    const sessionId: string | null = body?.sessionId ?? null;

    if (query.length < 2) {
      return NextResponse.json({ ok: true });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "FeedSearchLog" ("query", "sessionId", "createdAt") VALUES ($1, $2, now())`,
      query,
      sessionId,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[track-search]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
