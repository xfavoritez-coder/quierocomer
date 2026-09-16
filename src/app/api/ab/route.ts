import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { variant, eventType, sessionId } = await req.json();
    if (!variant || !eventType) return NextResponse.json({ ok: false }, { status: 400 });
    if (!["A", "B"].includes(variant)) return NextResponse.json({ ok: false }, { status: 400 });
    if (!["impression", "click", "lead"].includes(eventType)) return NextResponse.json({ ok: false }, { status: 400 });

    await prisma.$executeRaw`
      INSERT INTO "AbEvent" (id, variant, "eventType", "sessionId", "createdAt")
      VALUES (gen_random_uuid()::text, ${variant}, ${eventType}, ${sessionId ?? null}, now())
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ab/track]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
