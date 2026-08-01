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
  // Apple envía passesUpdatedSince en segundos (Unix epoch).
  // Soportamos también ms por compatibilidad con versiones anteriores del servidor.
  let sinceDate = new Date(0);
  if (since) {
    const n = Number(since);
    // Si el valor es < 1e12 es segundos (antes del año 2001 en ms); si no, ms
    sinceDate = new Date(n < 1e12 ? n * 1000 : n);
  }

  const members = await prisma.loyaltyMember.findMany({
    where: { id: { in: serials }, updatedAt: { gt: sinceDate } },
    select: { id: true, updatedAt: true },
  });
  if (members.length === 0) return new NextResponse(null, { status: 204 });

  // Devolver en segundos (spec Apple PassKit Web Service)
  const lastUpdated = String(Math.floor(Math.max(...members.map((m) => m.updatedAt.getTime())) / 1000));
  return NextResponse.json({ lastUpdated, serialNumbers: members.map((m) => m.id) });
}
