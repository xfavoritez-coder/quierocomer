import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";
import { fmtChile } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: any): number | null => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));

/** POST /api/driver/location-ping  Body: { delivery_id, lat, lng, accuracy_m?, speed_mps?, heading_deg?, battery_level? } */
export async function POST(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = (body?.delivery_id ?? "").toString();
  const lat = num(body?.lat), lng = num(body?.lng);
  if (!id || lat == null || lng == null) return NextResponse.json({ ok: false, error: "Faltan parámetros." }, { status: 422 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { id: true, restaurantId: true, opsStage: true, assignedDriverId: true } });
  if (!order || order.restaurantId !== driver.restaurantId) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  if (order.assignedDriverId !== driver.id) return NextResponse.json({ ok: false, error: "Este pedido no está asignado a este repartidor." }, { status: 403 });
  if (!["ready", "out_for_delivery"].includes(order.opsStage)) return NextResponse.json({ ok: false, error: "El pedido no está en reparto." }, { status: 409 });

  const accuracyM = num(body?.accuracy_m), speedMps = num(body?.speed_mps), headingDeg = num(body?.heading_deg), batteryLevel = num(body?.battery_level);

  await prisma.$transaction([
    prisma.posOrder.update({ where: { id }, data: { lastLat: lat, lastLng: lng, lastAccuracyM: accuracyM, lastSpeedMps: speedMps, lastHeadingDeg: headingDeg, trackingLastPingAt: new Date() } }),
    prisma.posDriverLocation.create({ data: { posOrderId: id, driverId: driver.id, lat, lng, accuracyM, speedMps, headingDeg, batteryLevel } }),
  ]);

  return NextResponse.json({ ok: true, server_time: fmtChile(new Date()) });
}
