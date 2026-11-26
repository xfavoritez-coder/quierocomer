import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant } from "@/lib/ventas/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ventas/leads/[id]/live?since=ISO — lo que el dueño hizo en su celular durante
 *  la demo (llamar al garzón, inscribirse en la tarjeta), para mostrarlo en vivo. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const r = await getLeadDemoRestaurant(lead.generatedSlug);
  if (!r) return NextResponse.json({ events: [] });

  const sinceRaw = Date.parse(req.nextUrl.searchParams.get("since") || "");
  const since = new Date(Number.isFinite(sinceRaw) ? Math.max(sinceRaw, Date.now() - 3600_000) : Date.now() - 60_000);
  const [calls, members, orders] = await Promise.all([
    prisma.waiterCall.findMany({ where: { restaurantId: r.id, createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true, tableName: true, createdAt: true } }),
    prisma.loyaltyMember.findMany({ where: { restaurantId: r.id, enrolledAt: { gt: since } }, orderBy: { enrolledAt: "asc" }, take: 10, select: { id: true, name: true, stamps: true, enrolledAt: true } }),
    prisma.onlineOrder.findMany({ where: { restaurantId: r.id, createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true, orderNumber: true, customerName: true, customerPhone: true, paymentMethod: true, customerNote: true, notes: true, items: true, total: true, createdAt: true } }),
  ]);
  const itemsSummary = (items: unknown) => (Array.isArray(items) ? items : [])
    .map((it) => { const o = (it || {}) as Record<string, unknown>; return `${Number(o.quantity) || 1}× ${String(o.dishName ?? o.name ?? "Plato")}`; })
    .slice(0, 3).join(" · ");
  const lines = (items: unknown) => (Array.isArray(items) ? items : []).slice(0, 20).map((it) => {
    const o = (it || {}) as Record<string, unknown>;
    const qty = Number(o.quantity) || 1;
    return { name: String(o.dishName ?? o.name ?? "Plato"), qty, price: Number(o.unit_price ?? o.unitPrice ?? o.price) || 0 };
  });
  const events = [
    ...calls.map((c) => ({ id: `w_${c.id}`, type: "waiter_called" as const, label: c.tableName || "Una mesa", at: c.createdAt.toISOString() })),
    ...members.map((m) => ({ id: `l_${m.id}`, type: "loyalty_enrolled" as const, label: m.name || "Alguien", stamps: m.stamps, at: m.enrolledAt.toISOString() })),
    ...orders.map((o) => ({ id: `o_${o.id}`, type: "test_order" as const, label: `Pedido #${o.orderNumber ?? ""}`.trim(), detail: itemsSummary(o.items), total: o.total, customer: o.customerName,
      order: { number: o.orderNumber, customer: o.customerName, phone: o.customerPhone, payment: o.paymentMethod, note: o.customerNote || o.notes || null, lines: lines(o.items), total: o.total },
      at: o.createdAt.toISOString() })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return NextResponse.json({ events });
}
