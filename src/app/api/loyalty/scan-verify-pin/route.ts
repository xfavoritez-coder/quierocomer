import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST /api/loyalty/scan-verify-pin  body: { slug, token, pin }
export async function POST(req: NextRequest) {
  try {
    const { slug, token, pin } = await req.json();
    if (!slug || !token || !pin) return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return NextResponse.json({ ok: false, error: "Local no encontrado" }, { status: 404 });

    const program = await prisma.loyaltyProgram.findUnique({
      where: { restaurantId: restaurant.id },
      select: { scanToken: true, scanPinHash: true, scanEnabled: true },
    });

    if (!program?.scanToken || program.scanToken !== token) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });
    }
    if (!program.scanEnabled) {
      return NextResponse.json({ ok: false, error: "El escáner está desactivado" }, { status: 403 });
    }
    if (!program.scanPinHash) {
      return NextResponse.json({ ok: false, error: "PIN no configurado" }, { status: 403 });
    }

    const valid = await bcrypt.compare(String(pin), program.scanPinHash);
    if (!valid) return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
