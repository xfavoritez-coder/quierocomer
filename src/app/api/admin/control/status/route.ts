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

  const [restaurant, insumoCount, criticoCount] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { controlEnabled: true },
    }),
    prisma.insumo.count({ where: { restaurantId, activo: true } }),
    prisma.insumo.count({ where: { restaurantId, activo: true, esCritico: true } }),
  ]);

  return NextResponse.json({
    controlEnabled: restaurant?.controlEnabled ?? false,
    insumoCount,
    criticoCount,
  });
}
