import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAppleWalletConfigured, buildPkpass } from "@/lib/wallet/apple";

export const runtime = "nodejs";

// GET /api/loyalty/pass/apple/:id?t=authToken   (PÚBLICO, protegido por el token del miembro)
// Descarga el .pkpass para que el cliente lo agregue a Apple Wallet tras inscribirse.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAppleWalletConfigured()) {
    return new NextResponse(null, { status: 503 });
  }

  const { id } = await params;
  const token = req.nextUrl.searchParams.get("t");

  const member = await prisma.loyaltyMember.findUnique({
    where: { id },
    include: { program: true },
  });
  if (!member || !token || member.authToken !== token) {
    return new NextResponse(null, { status: 401 });
  }

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
}
