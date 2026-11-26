import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant } from "@/lib/ventas/leads";
import { syncPosOrderFromOnline } from "@/lib/ecommerce/syncPosFromOnline";
import { sendOrderStatusPush } from "@/lib/ecommerce/orderStatusPush";

export const runtime = "nodejs";
const STATUSES = new Set(["ACCEPTED", "PREPARING", "READY", "DONE"]);

/** POST /api/ventas/leads/[id]/order-stage  Body: { orderId, status }
 *  Durante la demo, el vendedor avanza el pedido de prueba desde la bandeja del POS y el dueño
 *  lo ve cambiar en vivo en su página de seguimiento. Solo pedidos de la tienda demo del lead. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const r = await getLeadDemoRestaurant(lead.generatedSlug);
  if (!r) return NextResponse.json({ error: "Sin tienda de demo" }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const orderId = String(b?.orderId || "");
  const status = String(b?.status || "");
  if (!orderId || !STATUSES.has(status)) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });

  const order = await prisma.onlineOrder.findFirst({ where: { id: orderId, restaurantId: r.id }, select: { id: true, status: true, statusHistory: true } });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.status === status) return NextResponse.json({ ok: true, status });

  const history = Array.isArray(order.statusHistory) ? (order.statusHistory as unknown[]) : [];
  await prisma.onlineOrder.update({ where: { id: order.id }, data: { status, statusHistory: [...history, { status, ts: new Date().toISOString(), by: "ventas_demo" }] as unknown as object } });
  await syncPosOrderFromOnline(order.id, status);
  await sendOrderStatusPush(order.id, status).catch(() => {});
  return NextResponse.json({ ok: true, status });
}
