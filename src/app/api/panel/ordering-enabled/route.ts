import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";

/**
 * PATCH /api/panel/ordering-enabled
 * Toggle orderingEnabled for a restaurant the panel user owns.
 * Simple auth: panel_id cookie must match the restaurant's ownerId.
 */
export async function PATCH(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; orderingEnabled?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, orderingEnabled } = body;
  if (!restaurantId || orderingEnabled === undefined) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  // Verify ownership — handle both owner and team member
  let allowed = false;
  if (panelId.startsWith("tm_")) {
    allowed = await teamMemberCanAccess(panelId.slice(3), restaurantId);
  } else {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    allowed = restaurant?.ownerId === panelId;
  }

  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { orderingEnabled },
    select: { slug: true },
  });

  revalidatePath(`/${updated.slug}`);
  revalidatePath(`/qr/${updated.slug}`);

  return NextResponse.json({ ok: true, orderingEnabled });
}
