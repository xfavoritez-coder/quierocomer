import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { slug, enabled } = await req.json();
  if (!slug || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Missing slug or enabled" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { weeklyEmailEnabled: enabled } });

  return NextResponse.json({ ok: true, enabled });
}
