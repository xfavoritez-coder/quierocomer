import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import {
  isGoogleWalletConfigured,
  upsertLoyaltyClass,
  upsertLoyaltyObject,
  generateSaveUrl,
  googleObjectId,
} from "@/lib/wallet/google";
import { isAppleWalletConfigured } from "@/lib/wallet/apple";

export const runtime = "nodejs";

// POST /api/loyalty/enroll  (PÚBLICO)
// El cliente se inscribe al programa de un restaurante y recibe sus tarjetas.
export async function POST(req: NextRequest) {
  try {
    // Anti-spam por IP
    const ip = getClientIp(req);
    const rl = rateLimit(`enroll:${ip}`, { limit: 8, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json({ error: "Demasiados intentos, espera un momento." }, { status: 429 });
    }

    const body = await req.json();
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
    const birthDateRaw = typeof body.birthDate === "string" ? body.birthDate.trim() : "";
    const birthDate = birthDateRaw ? new Date(birthDateRaw + "T12:00:00Z") : null;

    if (!slug) return NextResponse.json({ error: "Restaurante no especificado" }, { status: 400 });
    if (!name && !email && !phone) {
      return NextResponse.json({ error: "Ingresa tu nombre y un contacto" }, { status: 400 });
    }
    if (email && !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

    const program = await prisma.loyaltyProgram.findUnique({ where: { restaurantId: restaurant.id } });
    if (!program || !program.active) {
      return NextResponse.json({ error: "El programa de fidelidad no está disponible." }, { status: 403 });
    }

    // Crear el miembro
    const member = await prisma.loyaltyMember.create({
      data: {
        programId: program.id,
        restaurantId: restaurant.id,
        name: name || null,
        email: email || null,
        phone: phone || null,
        birthDate: birthDate || null,
      },
    });

    // Google Wallet: crear objeto y link (si está configurado)
    let googleSaveUrl: string | null = null;
    if (isGoogleWalletConfigured()) {
      try {
        await upsertLoyaltyClass(program, restaurant.name, restaurant.logoUrl);
        await upsertLoyaltyObject(member, program, restaurant.name);
        const objectId = googleObjectId(member.id);
        await prisma.loyaltyMember.update({ where: { id: member.id }, data: { googleObjectId: objectId } });
        googleSaveUrl = generateSaveUrl(objectId);
      } catch (e) {
        console.error("[enroll] Google:", e);
      }
    }

    return NextResponse.json({
      memberId: member.id,
      token: member.authToken,
      googleSaveUrl,
      appleUrl: isAppleWalletConfigured() ? `/api/loyalty/pass/apple/${member.id}?t=${member.authToken}` : null,
    });
  } catch (e: any) {
    console.error("[Loyalty enroll]", e);
    return NextResponse.json({ error: "Error al inscribirse" }, { status: 500 });
  }
}
