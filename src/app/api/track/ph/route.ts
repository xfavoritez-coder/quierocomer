import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_PAGES = new Set(["landing", "pedir", "fidelidad", "resena"]);

export async function POST(req: NextRequest) {
  try {
    const { restaurantId, page } = await req.json();
    if (!restaurantId || !VALID_PAGES.has(page)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await prisma.pageHit.create({ data: { restaurantId, page } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
