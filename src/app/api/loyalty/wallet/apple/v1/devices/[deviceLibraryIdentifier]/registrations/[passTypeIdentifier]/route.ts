import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET → lista los serialNumbers de pases actualizados desde `passesUpdatedSince`.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string }> },
) {
  const { deviceLibraryIdentifier } = await params;
  const since = req.nextUrl.searchParams.get("passesUpdatedSince");

  const devices = await prisma.loyaltyDevice.findMany({
    where: { deviceLibraryIdentifier },
    select: { serialNumber: true },
  });
  if (devices.length === 0) return new NextResponse(null, { status: 204 });

  const serials = devices.map((d) => d.serialNumber);
  // Devolvemos todos los serials del dispositivo sin filtrar por timestamp.
  // El historial de `passesUpdatedSince` causaba bugs por discrepancias de
  // ms vs segundos entre lo que devolvíamos y lo que Apple re-enviaba.
  // El endpoint del pase ya maneja If-Modified-Since para evitar re-descargas innecesarias.
  const lastUpdated = String(Math.floor(Date.now() / 1000));
  return NextResponse.json({ lastUpdated, serialNumbers: serials });
}
