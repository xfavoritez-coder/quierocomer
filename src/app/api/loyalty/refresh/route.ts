import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import { ensureProgram } from "@/lib/loyalty";
import { isGoogleWalletConfigured, upsertLoyaltyClass } from "@/lib/wallet/google";
import { notifyRestaurantDevices } from "@/lib/wallet/apns";

export const runtime = "nodejs";

// POST /api/loyalty/refresh → refresca el DISEÑO de todos los pases ya instalados.
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json().catch(() => ({}));
    const restaurantId = body.restaurantId as string | undefined;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const program = await ensureProgram(restaurantId);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, logoUrl: true },
    });

    // Google: actualizar la clase → el diseño se propaga a todos los holders
    let google = false;
    if (isGoogleWalletConfigured()) {
      try {
        await upsertLoyaltyClass(program, restaurant?.name || "Restaurante", restaurant?.logoUrl);
        google = true;
      } catch (e) {
        console.error("[Loyalty refresh] Google:", e);
      }
    }

    // Apple: marcar todos los pases como cambiados y avisar a los dispositivos
    await prisma.$executeRaw`UPDATE "LoyaltyMember" SET "updatedAt" = NOW() WHERE "restaurantId" = ${restaurantId} AND "revoked" = false`;
    const appleDevices = await notifyRestaurantDevices(restaurantId);

    return NextResponse.json({ ok: true, appleDevices, google });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty refresh]", e);
    return NextResponse.json({ error: e.message || "Error al actualizar" }, { status: 500 });
  }
}
