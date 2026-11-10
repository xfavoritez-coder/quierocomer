import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ecommerce/check-items?restaurantId=X&ids=id1,id2,id3
 *
 * Devuelve qué product_ids del carrito ya no están disponibles para pedir:
 * producto inactivo, eliminado, oculto del ecommerce o agotado.
 * Usado por CartDrawer para alertar al usuario antes del checkout.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const idsRaw = req.nextUrl.searchParams.get("ids") || "";
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  if (!restaurantId || ids.length === 0) {
    return NextResponse.json({ unavailable: [] });
  }

  const available = await prisma.dish.findMany({
    where: {
      id: { in: ids },
      restaurantId,
      isActive: true,
      deletedAt: null,
      hideFromOrdering: false,
      soldOut: false,
    },
    select: { id: true },
  });

  const availableSet = new Set(available.map((d) => d.id));
  const unavailable = ids.filter((id) => !availableSet.has(id));

  return NextResponse.json({ unavailable });
}
