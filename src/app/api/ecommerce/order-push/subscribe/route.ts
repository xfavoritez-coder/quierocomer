import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { orderId, subscription } — guarda la suscripción push del cliente en su
 *  pedido para avisarle los cambios de estado. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderId = (body?.orderId || "").toString();
  const sub = body?.subscription;
  if (!orderId || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const order = await prisma.onlineOrder.findUnique({ where: { id: orderId }, select: { id: true, source: true } });
  if (!order || order.source !== "ecommerce") return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.onlineOrder.update({
    where: { id: orderId },
    data: { pushSubscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } } as unknown as object },
  });
  return NextResponse.json({ ok: true });
}
