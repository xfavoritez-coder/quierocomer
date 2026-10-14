import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

    // Orden por ÚLTIMA ACTIVIDAD de la tarjeta: cualquier cambio (registro o
    // sello) la pone primera. La actividad = el más reciente entre la fecha de
    // registro (enrolledAt), el último sello (lastStampAt) y el último escaneo/
    // canje (lastScanAt). Se ordena a nivel de BD con GREATEST para que funcione
    // correctamente con paginación sin importar cuántos miembros haya.
    const like = q ? `%${q}%` : null;
    const rows = await prisma.$queryRaw<Array<{
      id: string; name: string | null; email: string | null; phone: string | null;
      stamps: number; redeemedTiers: number[]; completedCards: number;
      enrolledAt: Date; lastStampAt: Date | null; birthDate: Date | null;
      appleSerial: string | null; googleObjectId: string | null;
    }>>(Prisma.sql`
      SELECT "id", "name", "email", "phone", "stamps", "redeemedTiers", "completedCards",
             "enrolledAt", "lastStampAt", "birthDate", "appleSerial", "googleObjectId"
      FROM "LoyaltyMember"
      WHERE "restaurantId" = ${restaurantId} AND "revoked" = false
      ${like ? Prisma.sql`AND ("name" ILIKE ${like} OR "email" ILIKE ${like} OR "phone" ILIKE ${like})` : Prisma.empty}
      ORDER BY GREATEST("enrolledAt", COALESCE("lastStampAt", "enrolledAt"), COALESCE("lastScanAt", "enrolledAt")) DESC
      LIMIT 200
    `);

    // Deriva el tipo de dispositivo y no expone los identificadores de wallet.
    const mapped = rows.map(({ appleSerial, googleObjectId, ...m }) => ({
      ...m,
      device: appleSerial ? "ios" : googleObjectId ? "android" : null,
    }));

    return NextResponse.json({ members: mapped, total: mapped.length });
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
    const birthDateRaw = typeof body.birthDate === "string" ? body.birthDate.trim() : "";
    const birthDate = birthDateRaw ? new Date(birthDateRaw + "T12:00:00Z") : null;

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
        birthDate: birthDate || null,
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
        birthDate: true,
      },
    });

    return NextResponse.json({ member: { ...member, device: null } });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Loyalty members POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
