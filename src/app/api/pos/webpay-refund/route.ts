// ═══════════════════════════════════════════════════════════
//  Reembolso de dinero Transbank/Webpay para un pedido del POS.
//  Solo aplica a pedidos web pagados con Webpay (PosOrder.externalId = "oo-<id>"
//  → OnlineOrder con paymentGateway "webpay" + token). Reembolsa vía Transbank
//  (total o parcial) y marca el OnlineOrder como reembolsado.
//
//  GET  ?restaurantId=&posOrderId=  → { eligible, total, refunded, reason? }
//  POST { restaurantId, posOrderId, amount? }  → { ok, type, amount, full }
//
//  Disponible para TODO local con Transbank configurado (no depende del toggle
//  showWebpayToken del admin): basta que el pedido se haya pagado con Webpay.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { webpayRefund, webpaySettingsFor } from "@/lib/payments/webpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** Resuelve el OnlineOrder de pago Webpay detrás de un PosOrder (pedido web espejado). */
async function resolveWebpayOnlineOrder(posOrderId: string, restaurantId: string) {
  const pos = await prisma.posOrder.findUnique({ where: { id: posOrderId }, select: { id: true, restaurantId: true, externalId: true } });
  if (!pos || pos.restaurantId !== restaurantId) return { error: "Pedido no encontrado", status: 404 as const };
  const ooId = pos.externalId?.startsWith("oo-") ? pos.externalId.slice(3) : null;
  if (!ooId) return { notWeb: true as const };
  const oo = await prisma.onlineOrder.findUnique({
    where: { id: ooId },
    select: { id: true, restaurantId: true, total: true, webpayToken: true, paymentGateway: true, paymentStatus: true, statusHistory: true, restaurant: { select: { ecommerceConfig: true } } },
  });
  if (!oo || oo.restaurantId !== restaurantId) return { notWeb: true as const };
  return { oo };
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  if (!restaurantId || !posOrderId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await resolveWebpayOnlineOrder(posOrderId, restaurantId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if ("notWeb" in r) return NextResponse.json({ eligible: false, reason: "no-web" });

  const oo = r.oo;
  const refunded = oo.paymentStatus === "refunded" || oo.paymentStatus === "partial_refund";
  const isWebpay = oo.paymentGateway === "webpay" && !!oo.webpayToken;
  const eligible = isWebpay && oo.paymentStatus === "paid";
  return NextResponse.json({
    eligible,
    refunded,
    total: isWebpay ? oo.total : 0,
    reason: !isWebpay ? "no-webpay" : refunded ? "refunded" : eligible ? null : "not-paid",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const posOrderId = (body?.posOrderId || "").toString();
  if (!restaurantId || !posOrderId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await resolveWebpayOnlineOrder(posOrderId, restaurantId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if ("notWeb" in r) return NextResponse.json({ error: "El pedido no es un pago web" }, { status: 400 });

  const oo = r.oo;
  if (oo.paymentGateway !== "webpay" || !oo.webpayToken) return NextResponse.json({ error: "El pedido no tiene una transacción Webpay" }, { status: 400 });
  if (oo.paymentStatus === "refunded") return NextResponse.json({ error: "El pedido ya fue reembolsado por completo" }, { status: 400 });

  const amount = Math.round(Number(body?.amount) || oo.total);
  if (!Number.isFinite(amount) || amount <= 0 || amount > oo.total) {
    return NextResponse.json({ error: "Monto de reembolso inválido" }, { status: 400 });
  }

  const res = await webpayRefund(oo.webpayToken, amount, webpaySettingsFor({ ecommerceConfig: oo.restaurant.ecommerceConfig }));
  if (!res.ok) return NextResponse.json({ error: res.error || "No se pudo reembolsar" }, { status: 400 });

  // Transbank es la fuente de verdad del dinero; reflejamos el estado en el OnlineOrder.
  const full = amount >= oo.total;
  const hist = Array.isArray(oo.statusHistory) ? (oo.statusHistory as unknown[]) : [];
  hist.push({ type: "REFUND_LOG", ts: new Date().toISOString(), amount, refundType: res.type || null, full, source: "pos" });
  await prisma.onlineOrder.update({
    where: { id: oo.id },
    data: { paymentStatus: full ? "refunded" : "partial_refund", statusHistory: hist as unknown as object },
  });

  return NextResponse.json({ ok: true, type: res.type, amount, full });
}
