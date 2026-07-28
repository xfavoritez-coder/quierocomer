import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";
import {
  isGoogleWalletConfigured,
  upsertLoyaltyClass,
  upsertLoyaltyObject,
  generateSaveUrl,
  googleObjectId,
} from "@/lib/wallet/google";

// GET /api/loyalty/members/:id/wallet/google
// Crea (o actualiza) la clase y el objeto de Google Wallet para el miembro
// y devuelve el link "Guardar en Google Wallet".
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    if (!isGoogleWalletConfigured()) {
      return NextResponse.json({ error: "Google Wallet no está configurado (faltan variables de entorno)" }, { status: 503 });
    }

    const { id } = await params;
    const member = await getMemberForOwner(req, id);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: member.restaurantId },
      select: { name: true, logoUrl: true },
    });

    await upsertLoyaltyClass(member.program, restaurant?.name || "Restaurante", restaurant?.logoUrl);
    await upsertLoyaltyObject(member, member.program, restaurant?.name || "Restaurante");

    // Guarda el objectId en el miembro (si aún no lo tenía)
    const objectId = googleObjectId(member.id);
    if (member.googleObjectId !== objectId) {
      await prisma.loyaltyMember.update({ where: { id }, data: { googleObjectId: objectId } });
    }

    return NextResponse.json({ saveUrl: generateSaveUrl(objectId) });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty google wallet]", e);
    return NextResponse.json({ error: e.message || "Error al generar la tarjeta" }, { status: 500 });
  }
}
