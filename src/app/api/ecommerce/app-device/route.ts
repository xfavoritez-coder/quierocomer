// ═══════════════════════════════════════════════════════════
//  Registro del dispositivo de la app (Capacitor) de un CLIENTE, para enviar
//  notificaciones push (promos). La app lo llama al abrir, con su token APNs/FCM.
//  Upsert por token (único). No prende el permiso: solo registra si la app ya lo
//  obtuvo. Para desuscribir: optedIn=false.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = String(body?.restaurantId || "").trim();
  const platform = body?.platform === "ios" ? "ios" : body?.platform === "android" ? "android" : null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : undefined;
  const optedIn = body?.optedIn === false ? false : true;

  if (!restaurantId || !platform || !token) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    await prisma.appDevice.upsert({
      where: { token },
      create: { restaurantId, platform, token, optedIn, ...(phone ? { customerPhone: phone } : {}) },
      update: { restaurantId, platform, optedIn, lastSeenAt: new Date(), ...(phone ? { customerPhone: phone } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[app-device] upsert", String(e));
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
