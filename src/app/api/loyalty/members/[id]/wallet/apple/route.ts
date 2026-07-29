import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";
import { isAppleWalletConfigured, buildPkpass } from "@/lib/wallet/apple";

export const runtime = "nodejs";

// GET /api/loyalty/members/:id/wallet/apple
// Devuelve el archivo .pkpass firmado (Apple Wallet).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    if (!isAppleWalletConfigured()) {
      return NextResponse.json({ error: "Apple Wallet no está configurado (faltan variables de entorno)" }, { status: 503 });
    }

    const { id } = await params;
    const member = await getMemberForOwner(req, id);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: member.restaurantId },
      select: { name: true, logoUrl: true },
    });

    const pkpass = await buildPkpass(member, member.program, restaurant?.name || "Restaurante", restaurant?.logoUrl);

    return new NextResponse(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${member.id}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty apple wallet]", e);
    return NextResponse.json({ error: e.message || "Error al generar la tarjeta" }, { status: 500 });
  }
}
