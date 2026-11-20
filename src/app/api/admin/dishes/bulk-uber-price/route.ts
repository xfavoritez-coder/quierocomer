import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export const runtime = "nodejs";

/** POST /api/admin/dishes/bulk-uber-price  { restaurantId, percent, activeOnly? }
 *  Fija el precio de Uber Eats de TODOS los platos del local como el precio de carta
 *  más `percent`% (uberEatsPrice = round(price * (1 + percent/100))). Uber cobra
 *  comisión → se publica más alto. Sobrescribe los uberEatsPrice existentes. */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurantId || "");
    const percent = Number(body?.percent);
    const activeOnly = body?.activeOnly === true;
    if (!restaurantId || !Number.isFinite(percent)) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    if (percent < -90 || percent > 500) return NextResponse.json({ error: "El porcentaje debe estar entre -90 y 500" }, { status: 400 });
    await assertOwnsRestaurant(req, restaurantId);

    const factor = 1 + percent / 100;
    // Prisma updateMany no soporta aritmética sobre columnas → SQL crudo (parametrizado).
    const updated = activeOnly
      ? await prisma.$executeRaw`UPDATE "Dish" SET "uberEatsPrice" = ROUND("price" * ${factor}::float) WHERE "restaurantId" = ${restaurantId} AND "deletedAt" IS NULL AND "price" > 0 AND "isActive" = true`
      : await prisma.$executeRaw`UPDATE "Dish" SET "uberEatsPrice" = ROUND("price" * ${factor}::float) WHERE "restaurantId" = ${restaurantId} AND "deletedAt" IS NULL AND "price" > 0`;

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    return authErrorResponse(e as { status?: number; message?: string });
  }
}
