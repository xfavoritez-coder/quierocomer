import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — list reviews for a restaurant
export async function GET(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  // Verify ownership
  let allowed = false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    allowed = m?.restaurantId === restaurantId;
  } else {
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
    allowed = r?.ownerId === panelId;
  }
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const reviews = await prisma.privateReview.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = reviews.filter(r => !r.isRead).length;
  return NextResponse.json({ reviews, unread });
}

// PATCH — mark review(s) as read
export async function PATCH(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { id?: string; restaurantId?: string; markAllRead?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { id, restaurantId, markAllRead } = body;

  if (markAllRead && restaurantId) {
    await prisma.privateReview.updateMany({ where: { restaurantId, isRead: false }, data: { isRead: true } });
  } else if (id) {
    await prisma.privateReview.update({ where: { id }, data: { isRead: true } });
  }

  return NextResponse.json({ ok: true });
}
