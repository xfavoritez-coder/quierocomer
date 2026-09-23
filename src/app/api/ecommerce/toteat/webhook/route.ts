import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractOrders, mapToteatOrder } from "@/lib/ecommerce/posOrders";
import { notifyNewPosOrder } from "@/lib/ecommerce/notifyPosOrder";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { sendWhatsappTemplate } from "@/lib/ecommerce/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → sonda de salud (Toteat/valida la URL con GET). */
export async function GET() {
  return new NextResponse("Webhook de pedidos activo (usa POST)\n", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function mask(t: string): string {
  if (!t) return "(vacío)";
  if (t.length <= 8) return t[0] + "***" + t[t.length - 1];
  return t.slice(0, 4) + "…" + t.slice(-4) + ` (${t.length})`;
}

/** Registra el intento (best-effort, nunca rompe la respuesta). */
async function log(row: {
  restaurantId: string | null; ok: boolean; reason: string; processed?: number;
  tokenPreview: string; tokenVia: string; headerKeys: string; method: string; ip: string; bodyPreview: string;
}) {
  try {
    await prisma.posWebhookLog.create({ data: { processed: 0, ...row } });
  } catch { /* noop */ }
}

/**
 * POST /api/ecommerce/toteat/webhook
 * Recibe los pedidos de Toteat de UN local, identificado por su token:
 *   - Header `x-webhook-token: <token>`  (preferido), o
 *   - Query `?token=<token>`             (fallback si Toteat no permite headers).
 * Registra cada intento en PosWebhookLog para diagnóstico.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const headerKeys = Array.from(req.headers.keys()).join(", ");
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  const bodyPreview = raw.slice(0, 600);

  // Toteat puede enviar el secreto de varias formas según el mecanismo:
  //  - Webhook oficial (/v3/webhooks-configuration): `Authorization: SECRET` y `x-api-key: SECRET`.
  //  - Post Hook con "Custom Headers": el header que definas (ej. `x-webhook-token`).
  //  - Fallback nuestro: `?token=` en la URL.
  // Aceptamos todas y resolvemos el local por cualquiera que calce (token es @unique).
  const stripPrefix = (v: string) => v.replace(/^(Bearer|Basic)\s+/i, "").trim();
  const sources: [string, string | null][] = [
    ["x-api-key", req.headers.get("x-api-key")],
    ["authorization", req.headers.get("authorization")],
    ["x-webhook-token", req.headers.get("x-webhook-token")],
    ["query", req.nextUrl.searchParams.get("token")],
  ];
  const candidates: { via: string; val: string }[] = [];
  for (const [via, raw] of sources) {
    if (!raw) continue;
    const t = raw.trim();
    if (t) candidates.push({ via, val: t });
    const b = stripPrefix(t);
    if (b && b !== t) candidates.push({ via, val: b });
  }
  const tokenVia = candidates[0]?.via ?? "none";
  const base = { tokenPreview: candidates.length ? mask(candidates[0].val) : "(vacío)", tokenVia, headerKeys, method: "POST", ip, bodyPreview };

  if (!candidates.length) {
    await log({ restaurantId: null, ok: false, reason: "sin_token", ...base });
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const restaurant = await prisma.restaurant.findFirst({ where: { toteatWebhookSecret: { in: candidates.map((c) => c.val) } }, select: { id: true } });
  if (!restaurant) {
    await log({ restaurantId: null, ok: false, reason: "token_no_reconocido", ...base });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const restaurantId = restaurant.id;

  let payload: unknown;
  try { payload = JSON.parse(raw || "null"); } catch {
    await log({ restaurantId, ok: false, reason: "json_invalido", ...base });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orders = extractOrders(payload);
  if (!orders.length) {
    await log({ restaurantId, ok: true, reason: "sin_pedidos_en_payload", ...base });
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  const nuevos: { id: string; externalId: string; customerName: string; customerPhone: string; orderReference: string; total: number; isDelivery: boolean }[] = [];

  for (const ord of orders) {
    const m = mapToteatOrder(ord);
    if (!m) continue;

    const data = {
      posStatus: m.posStatus, saleType: m.saleType, isDelivery: m.isDelivery, tableLabel: m.tableLabel,
      customerName: m.customerName, customerPhone: m.customerPhone, addressLine: m.addressLine,
      totalAmount: m.totalAmount, paidAmount: m.paidAmount, tipAmount: m.tipAmount, changeAmount: m.changeAmount,
      deliveryFee: m.deliveryFee, discountAmount: m.discountAmount, currency: m.currency,
      vendorName: m.vendorName, orderReference: m.orderReference,
      items: m.items ?? undefined, rawPayload: ord as any, completedAt: m.completedAt,
    };

    const existing = await prisma.posOrder.findUnique({
      where: { restaurantId_externalId: { restaurantId, externalId: m.externalId } },
      select: { id: true },
    });
    if (existing) {
      await prisma.posOrder.update({ where: { id: existing.id }, data });
    } else {
      const created = await prisma.posOrder.create({ data: { restaurantId, externalId: m.externalId, provider: "toteat", ...data }, select: { id: true } });
      nuevos.push({ id: created.id, externalId: m.externalId, customerName: m.customerName, customerPhone: m.customerPhone, orderReference: m.orderReference || m.externalId, total: m.totalAmount, isDelivery: m.isDelivery });
    }
    processed++;
  }

  for (const n of nuevos) {
    void notifyNewPosOrder({ restaurantId, id: n.id, customerName: n.customerName, total: n.total, isDelivery: n.isDelivery }).catch(() => {});
  }

  // WhatsApp al cliente (Twilio) por cada pedido NUEVO, si el local lo tiene activo.
  if (nuevos.length) {
    void (async () => {
      try {
        const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, ecommerceConfig: true } });
        const twilio = parseEcommerceConfig(r?.ecommerceConfig).twilio;
        const enabled = !!(twilio?.enabled && twilio.accountSid && twilio.authToken && (twilio.from || twilio.messagingServiceSid) && twilio.contentSid);
        if (!enabled) return;
        const storeName = (r?.name || "").trim() || "el local";
        for (const n of nuevos) {
          if (!n.customerPhone?.trim()) continue;
          if (n.externalId.startsWith("TEST-")) continue; // no avisar en pedidos de prueba
          await sendWhatsappTemplate(twilio!, n.customerPhone, {
            "1": n.customerName || "Cliente",
            "2": n.orderReference || "",
            "3": storeName,
          }).catch(() => ({ ok: false }));
        }
      } catch { /* noop */ }
    })();
  }

  try {
    await prisma.posWebhookLog.create({ data: { restaurantId, ok: true, reason: "ok", processed, ...base } });
  } catch { /* noop */ }

  return NextResponse.json({ ok: true, processed, created: nuevos.length });
}
