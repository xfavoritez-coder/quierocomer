import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractOrders, mapToteatOrder } from "@/lib/ecommerce/posOrders";
import { notifyNewPosOrder } from "@/lib/ecommerce/notifyPosOrder";

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

  const headerToken = (req.headers.get("x-webhook-token") || "").trim();
  const queryToken = (req.nextUrl.searchParams.get("token") || "").trim();
  const token = headerToken || queryToken;
  const tokenVia = headerToken ? "header" : queryToken ? "query" : "none";
  const base = { tokenPreview: mask(token), tokenVia, headerKeys, method: "POST", ip, bodyPreview };

  if (!token) {
    await log({ restaurantId: null, ok: false, reason: "sin_token", ...base });
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const restaurant = await prisma.restaurant.findFirst({ where: { toteatWebhookSecret: token }, select: { id: true } });
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
  const nuevos: { id: string; customerName: string; total: number; isDelivery: boolean }[] = [];

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
      nuevos.push({ id: created.id, customerName: m.customerName, total: m.totalAmount, isDelivery: m.isDelivery });
    }
    processed++;
  }

  for (const n of nuevos) {
    void notifyNewPosOrder({ restaurantId, id: n.id, customerName: n.customerName, total: n.total, isDelivery: n.isDelivery }).catch(() => {});
  }

  try {
    await prisma.posWebhookLog.create({ data: { restaurantId, ok: true, reason: "ok", processed, ...base } });
  } catch { /* noop */ }

  return NextResponse.json({ ok: true, processed, created: nuevos.length });
}
