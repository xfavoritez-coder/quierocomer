import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import { ensureProgram } from "@/lib/loyalty";

// GET /api/loyalty/members?restaurantId=xxx&q=texto
// Lista los miembros del restaurante (con búsqueda opcional por nombre/email/teléfono).
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const q = (req.nextUrl.searchParams.get("q") || "").trim();

    const members = await prisma.loyaltyMember.findMany({
      where: {
        restaurantId,
        revoked: false,
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: [{ lastStampAt: { sort: "desc", nulls: "last" } }, { enrolledAt: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        stamps: true,
        redeemedTiers: true,
        completedCards: true,
        enrolledAt: true,
        lastStampAt: true,
      },
    });

    return NextResponse.json({ members, total: members.length });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Loyalty members GET]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

// POST /api/loyalty/members
// Crea un miembro manualmente (name, email, phone). Requiere al menos un dato de contacto.
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const restaurantId = body.restaurantId as string | undefined;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";

    if (!name && !email && !phone) {
      return NextResponse.json({ error: "Ingresa al menos nombre, email o teléfono" }, { status: 400 });
    }

    const program = await ensureProgram(restaurantId);

    const member = await prisma.loyaltyMember.create({
      data: {
        programId: program.id,
        restaurantId,
        name: name || null,
        email: email || null,
        phone: phone || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        stamps: true,
        redeemedTiers: true,
        completedCards: true,
        enrolledAt: true,
        lastStampAt: true,
      },
    });

    return NextResponse.json({ member });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Loyalty members POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
