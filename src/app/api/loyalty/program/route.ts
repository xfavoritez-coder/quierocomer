import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

// GET /api/loyalty/program?restaurantId=xxx
// Devuelve el programa de fidelidad del restaurante (o null si aún no existe).
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const program = await prisma.loyaltyProgram.findUnique({
      where: { restaurantId },
    });

    return NextResponse.json({ program });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Loyalty program GET]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

// POST /api/loyalty/program
// Crea o actualiza (upsert) la configuración del programa de sellos.
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const restaurantId = body.restaurantId as string | undefined;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    // Validación y saneo de campos
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : undefined;
    const rewardText =
      typeof body.rewardText === "string" && body.rewardText.trim()
        ? body.rewardText.trim().slice(0, 120)
        : undefined;
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 200) : undefined;
    const active = typeof body.active === "boolean" ? body.active : undefined;

    let stampsRequired: number | undefined;
    if (body.stampsRequired != null) {
      const n = Math.round(Number(body.stampsRequired));
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        return NextResponse.json({ error: "stampsRequired debe estar entre 1 y 50" }, { status: 400 });
      }
      stampsRequired = n;
    }

    let cardColorHex: string | undefined;
    if (typeof body.cardColorHex === "string") {
      const hex = body.cardColorHex.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return NextResponse.json({ error: "cardColorHex inválido (usa formato #RRGGBB)" }, { status: 400 });
      }
      cardColorHex = hex;
    }

    const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim().slice(0, 500) || null : undefined;

    const program = await prisma.loyaltyProgram.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        ...(name != null && { name }),
        ...(active != null && { active }),
        ...(stampsRequired != null && { stampsRequired }),
        ...(rewardText != null && { rewardText }),
        ...(cardColorHex != null && { cardColorHex }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(description != null && { description }),
      },
      update: {
        ...(name != null && { name }),
        ...(active != null && { active }),
        ...(stampsRequired != null && { stampsRequired }),
        ...(rewardText != null && { rewardText }),
        ...(cardColorHex != null && { cardColorHex }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(description != null && { description }),
      },
    });

    return NextResponse.json({ program });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Loyalty program POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
