import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PassKit Web Service — registro y baja de un dispositivo para un pase.
// El serialNumber es el id del LoyaltyMember; se autentica con su authToken.

async function authMember(req: NextRequest, serialNumber: string) {
  const member = await prisma.loyaltyMember.findUnique({
    where: { id: serialNumber },
    select: { id: true, authToken: true },
  });
  const auth = req.headers.get("authorization");
  if (!member || auth !== `ApplePass ${member.authToken}`) return null;
  return member;
}

// POST → registrar dispositivo. Body: { pushToken }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> },
) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
  const member = await authMember(req, serialNumber);
  if (!member) return new NextResponse(null, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pushToken = typeof body.pushToken === "string" ? body.pushToken : null;
  if (!pushToken) return new NextResponse(null, { status: 400 });

  const existing = await prisma.loyaltyDevice.findUnique({
    where: { deviceLibraryIdentifier_serialNumber: { deviceLibraryIdentifier, serialNumber } },
  });

  await prisma.loyaltyDevice.upsert({
    where: { deviceLibraryIdentifier_serialNumber: { deviceLibraryIdentifier, serialNumber } },
    create: { deviceLibraryIdentifier, serialNumber, pushToken, passTypeIdentifier },
    update: { pushToken, passTypeIdentifier },
  });

  // 201 si es nuevo, 200 si ya estaba
  return new NextResponse(null, { status: existing ? 200 : 201 });
}

// DELETE → dar de baja el dispositivo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; serialNumber: string }> },
) {
  const { deviceLibraryIdentifier, serialNumber } = await params;
  const member = await authMember(req, serialNumber);
  if (!member) return new NextResponse(null, { status: 401 });

  await prisma.loyaltyDevice.deleteMany({ where: { deviceLibraryIdentifier, serialNumber } });
  return new NextResponse(null, { status: 200 });
}
