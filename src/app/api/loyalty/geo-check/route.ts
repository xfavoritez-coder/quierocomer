import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAppleDevices } from "@/lib/wallet/apns";

export const runtime = "nodejs";

/** Haversine distance in km */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /api/loyalty/geo-check
 *
 * Llamado desde la página /fidelidad/pase/{id} cuando el miembro tiene
 * la ubicación disponible. Si está dentro del radio del local Y no se le
 * ha enviado una notificación por cercanía en las últimas 4 horas,
 * se envía un push → changeMessage → banner que auto-desaparece.
 *
 * Auth: memberId + authToken (mismo token del URL de la tarjeta).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, authToken, lat, lng } = body as Record<string, unknown>;

    if (
      typeof memberId !== "string" ||
      typeof authToken !== "string" ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return NextResponse.json({ ok: false });
    }

    // Verificar miembro y token
    const member = await prisma.loyaltyMember.findUnique({
      where: { id: memberId },
      select: { id: true, authToken: true, restaurantId: true, lastGeoNotifAt: true },
    });
    if (!member || member.authToken !== authToken || !member.restaurantId) {
      return NextResponse.json({ ok: false });
    }

    // Rate limit: una notificación por cercanía cada 4 horas por miembro
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
    if (member.lastGeoNotifAt && member.lastGeoNotifAt > cutoff) {
      return NextResponse.json({ ok: false, reason: "rate_limited" });
    }

    // Obtener config del programa (geo debe estar habilitado)
    const [program, restaurant] = await Promise.all([
      prisma.loyaltyProgram.findUnique({
        where: { restaurantId: member.restaurantId },
        select: { geoEnabled: true, geoRadiusKm: true, geoMessage: true },
      }),
      prisma.restaurant.findUnique({
        where: { id: member.restaurantId },
        select: { lat: true, lng: true, name: true },
      }),
    ]);

    if (!program?.geoEnabled) return NextResponse.json({ ok: false, reason: "geo_disabled" });
    if (!restaurant?.lat || !restaurant?.lng) return NextResponse.json({ ok: false, reason: "no_location" });

    // Verificar distancia
    const radiusKm = program.geoRadiusKm || 1;
    const dist = distanceKm(lat, lng, restaurant.lat, restaurant.lng);
    if (dist > radiusKm) return NextResponse.json({ ok: false, reason: "out_of_range" });

    // ¡El miembro está cerca! Actualizar pushMessage del programa y enviar push individual.
    // El \u200b + timestamp garantiza que el campo "novedad" cambie → changeMessage se dispara → banner.
    const geoMsg = program.geoMessage || `¡Estás cerca de ${restaurant.name}! Pasa a sumar sellos 👋`;
    const msgUniq = `${geoMsg}\u200b${Date.now()}`;

    await prisma.loyaltyProgram.update({
      where: { restaurantId: member.restaurantId },
      data: { pushMessage: msgUniq },
    });

    // Marcar la fecha antes del push para evitar doble envío en caso de retry
    await prisma.loyaltyMember.update({
      where: { id: memberId },
      data: { lastGeoNotifAt: new Date() },
    });

    // Push silencioso al dispositivo del miembro → Apple descarga el pase actualizado →
    // el campo "novedad" cambió → changeMessage dispara banner (no persistente).
    await notifyAppleDevices(memberId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[geo-check]", e);
    return NextResponse.json({ ok: false });
  }
}
