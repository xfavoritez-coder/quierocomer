import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeNativeTokens, type NativeToken } from "@/lib/ecommerce/nativeTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — guarda la suscripción push del cliente en su pedido para avisarle los
 *  cambios de estado. Acepta web push ({ orderId, subscription }), nativo
 *  ({ orderId, native: { platform: "ios"|"android", token } }) o el push token
 *  de la Live Activity de iOS ({ orderId, liveActivity: { token } }). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderId = (body?.orderId || "").toString();
  const sub = body?.subscription;
  const native = body?.native;
  const live = body?.liveActivity;

  const hasWeb = !!(sub?.endpoint && sub?.keys?.p256dh && sub?.keys?.auth);
  const platform = native?.platform === "ios" ? "ios" : native?.platform === "android" ? "android" : null;
  const hasNative = !!(platform && typeof native?.token === "string" && native.token);
  const hasLive = typeof live?.token === "string" && !!live.token;
  if (!orderId || (!hasWeb && !hasNative && !hasLive)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const order = await prisma.onlineOrder.findUnique({ where: { id: orderId }, select: { id: true, source: true, nativePush: true } });
  if (!order || order.source !== "ecommerce") return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (hasWeb) data.pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  if (hasNative) {
    // Acumula el dispositivo (sin pisar otros: iPhone + Android pueden convivir).
    const list = normalizeNativeTokens(order.nativePush).filter((t) => t.token !== native.token);
    list.push({ platform: platform as NativeToken["platform"], token: native.token });
    data.nativePush = list.slice(-10);
  }
  if (hasLive) data.liveActivityToken = live.token;

  await prisma.onlineOrder.update({ where: { id: orderId }, data: data as object });
  return NextResponse.json({ ok: true });
}
