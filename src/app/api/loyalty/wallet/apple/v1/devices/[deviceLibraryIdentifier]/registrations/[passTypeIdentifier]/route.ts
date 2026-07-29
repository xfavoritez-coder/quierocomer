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
  const sinceDate = since ? new Date(Number(since)) : new Date(0);

  const members = await prisma.loyaltyMember.findMany({
    where: { id: { in: serials }, updatedAt: { gt: sinceDate } },
    select: { id: true, updatedAt: true },
  });
  if (members.length === 0) return new NextResponse(null, { status: 204 });

  const lastUpdated = String(Math.max(...members.map((m) => m.updatedAt.getTime())));
  return NextResponse.json({ lastUpdated, serialNumbers: members.map((m) => m.id) });
}
