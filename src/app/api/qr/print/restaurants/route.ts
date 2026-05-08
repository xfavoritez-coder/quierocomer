import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/qr/print/restaurants
 *
 * Lista locales activos para el selector de impresion de QRs en
 * /imprimirqr. Devuelve solo datos publicos (los mismos que estan en
 * la URL del QR), por lo que no requiere auth.
 */
export async function GET() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      qrToken: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ restaurants });
}
