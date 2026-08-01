import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPkpass } from "@/lib/wallet/apple";

export const runtime = "nodejs";

// GET → devuelve el .pkpass actualizado del miembro (autenticado con su authToken).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serialNumber: string }> },
) {
  const { serialNumber } = await params;

  const member = await prisma.loyaltyMember.findUnique({
    where: { id: serialNumber },
    include: { program: true },
  });
  const auth = req.headers.get("authorization");
  if (!member || auth !== `ApplePass ${member.authToken}`) {
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
      "Last-Modified": member.updatedAt.toUTCString(),
    },
  });
}
