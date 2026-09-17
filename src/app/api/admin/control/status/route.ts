import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

/** GET /api/admin/control/status?restaurantId=X */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  try {
    await requireRestaurantForOwner(req, restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { controlEnabled: true, bodegaId: true },
  });
  const bodegaId = restaurant?.bodegaId ?? null;
  const [insumoCount, criticoCount] = bodegaId
    ? await Promise.all([
        prisma.insumo.count({ where: { bodegaId, activo: true } }),
        prisma.insumo.count({ where: { bodegaId, activo: true, esCritico: true } }),
      ])
    : [0, 0];

  return NextResponse.json({
    controlEnabled: restaurant?.controlEnabled ?? false,
    insumoCount,
    criticoCount,
  });
}
