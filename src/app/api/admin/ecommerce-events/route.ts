import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ecommerce-events?restaurantId=X
 * Devuelve lista de restaurantes con ecommerce habilitado para el selector.
 * Si restaurantId está presente, proxy a /api/panel/ecommerce/store-events/report
 * con cookies de admin.
 */
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Solo devuelve la lista de restaurantes con ecommerce
  const restaurants = await prisma.restaurant.findMany({
    where: { ecommerceEnabled: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ restaurants });
}
