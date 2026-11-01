import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/qr/waiter/test-notify  { restaurantId, endpoint? }
 * Envía una notificación de PRUEBA a la suscripción del garzón (su propio teléfono,
 * vía `endpoint`) o a todas las activas del restaurante. Sirve para que el garzón
 * verifique en vivo que el push llega y suena. Limpia suscripciones muertas (410).
 */
export async function POST(request: Request) {
  try {
    const { restaurantId, endpoint } = await request.json();
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

    const { sendWaiterTestNotification } = await import("@/lib/qr/utils/webpush");
    const [subs, restaurant] = await Promise.all([
      prisma.waiterPushSubscription.findMany({
        where: endpoint ? { endpoint } : { restaurantId, isActive: true },
      }),
      prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } }),
    ]);

    let sent = 0;
    let error: string | null = null;
    for (const s of subs) {
      try {
        await sendWaiterTestNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, restaurant?.slug);
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 410) {
          await prisma.waiterPushSubscription.update({ where: { id: s.id }, data: { isActive: false } });
        }
        error = e?.message || String(e);
      }
    }
    return NextResponse.json({ ok: true, sent, total: subs.length, error });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
