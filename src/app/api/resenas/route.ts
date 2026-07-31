import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: { restaurantId?: string; rating?: number; comment?: string | null; authorName?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, rating, comment, authorName } = body;
  if (!restaurantId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Only allow if restaurant has private mode
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { reviewMode: true },
  });
  if (!restaurant || restaurant.reviewMode !== "private") {
    return NextResponse.json({ error: "No disponible" }, { status: 403 });
  }

  await prisma.privateReview.create({
    data: { restaurantId, rating, comment: comment || null, authorName: authorName || null },
  });

  return NextResponse.json({ ok: true });
}
