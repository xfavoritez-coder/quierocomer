import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = (body?.query ?? "").trim();
    const sessionId: string | null = body?.sessionId ?? null;

    if (query.length < 2) {
      return NextResponse.json({ ok: true });
    }

    // Ensure table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FeedSearchLog" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "query" TEXT NOT NULL,
        "sessionId" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FeedSearchLog_pkey" PRIMARY KEY ("id")
      )
    `);

    // Insert the search
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
