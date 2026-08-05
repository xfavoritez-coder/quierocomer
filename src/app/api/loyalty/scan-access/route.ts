import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// GET /api/loyalty/scan-access?restaurantId=xxx
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const program = await prisma.loyaltyProgram.findUnique({
      where: { restaurantId },
      select: { scanToken: true, scanEnabled: true, scanPinHash: true },
    });
    return NextResponse.json({
      scanToken: program?.scanToken ?? null,
      scanEnabled: program?.scanEnabled ?? true,
      hasPin: !!program?.scanPinHash,
    });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

// POST /api/loyalty/scan-access
// Actions: generate (generate token), setPin (set PIN), toggleEnabled (enable/disable), regenerate (new token)
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const { restaurantId, action, pin } = body;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    if (action === "generate" || action === "regenerate") {
      const scanToken = randomBytes(24).toString("hex");
      const program = await prisma.loyaltyProgram.upsert({
        where: { restaurantId },
        create: { restaurantId, scanToken },
        update: { scanToken },
        select: { scanToken: true, scanEnabled: true, scanPinHash: true },
      });
      return NextResponse.json({ scanToken: program.scanToken, scanEnabled: program.scanEnabled, hasPin: !!program.scanPinHash });
    }

    if (action === "setPin") {
      if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
        return NextResponse.json({ error: "El PIN debe ser entre 4 y 8 dígitos numéricos" }, { status: 400 });
      }
      const scanPinHash = await bcrypt.hash(pin, 10);
      const program = await prisma.loyaltyProgram.upsert({
        where: { restaurantId },
        create: { restaurantId, scanPinHash },
        update: { scanPinHash },
        select: { scanToken: true, scanEnabled: true, scanPinHash: true },
      });
      return NextResponse.json({ scanToken: program.scanToken, scanEnabled: program.scanEnabled, hasPin: true });
    }

    if (action === "toggleEnabled") {
      const current = await prisma.loyaltyProgram.findUnique({ where: { restaurantId }, select: { scanEnabled: true } });
      const program = await prisma.loyaltyProgram.upsert({
        where: { restaurantId },
        create: { restaurantId },
        update: { scanEnabled: !current?.scanEnabled },
        select: { scanToken: true, scanEnabled: true, scanPinHash: true },
      });
      return NextResponse.json({ scanToken: program.scanToken, scanEnabled: program.scanEnabled, hasPin: !!program.scanPinHash });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
