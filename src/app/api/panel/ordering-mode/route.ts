import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/panel/ordering-mode
 * Auto-save orderingMode for a restaurant the panel user owns.
 * Simple auth: panel_id cookie must match the restaurant's ownerId.
 */
export async function PATCH(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; orderingMode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, orderingMode } = body;
  if (!restaurantId || !orderingMode) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  // Verify ownership — handle both owner and team member
  let allowed = false;
  if (panelId.startsWith("tm_")) {
    const memberId = panelId.slice(3);
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { restaurantId: true },
    });
    allowed = member?.restaurantId === restaurantId;
  } else {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    allowed = restaurant?.ownerId === panelId;
  }

  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { orderingMode },
  });

  return NextResponse.json({ ok: true, orderingMode });
}
