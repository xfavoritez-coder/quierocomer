import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail } from "@/lib/ecommerce/orderEmails";
import { sendSurveyEmail, storeAbsBase } from "@/lib/ecommerce/surveyEmail";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

// Valid status transitions
const TRANSITIONS: Record<string, string[]> = {
  PENDING:      ["ACCEPTED", "CANCELLED"],
  ACCEPTED:     ["PREPARING", "CANCELLED"],
  PREPARING:    ["IN_DELIVERY", "READY", "CANCELLED"],
  IN_DELIVERY:  ["DONE", "CANCELLED"],
  READY:        ["DONE", "CANCELLED"],
  DONE:         [],
  CANCELLED:    [],
};

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const allowed = await verifyAccess(req, restaurantId);
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Separación de pilares: por defecto solo pedir-online (legacy). El panel del
  // ecommerce pide ?source=ecommerce; ?source=all trae ambos.
  const source = req.nextUrl.searchParams.get("source") || "pedir-online";
  const [orders, restaurantConfig] = await Promise.all([
    prisma.onlineOrder.findMany({
      where: { restaurantId, ...(source === "all" ? {} : { source }) },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { orderingMode: true },
    }),
  ]);

  return NextResponse.json({ orders, orderingMode: restaurantConfig?.orderingMode ?? "whatsapp" });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.orderId || !body?.status) {
    return NextResponse.json({ error: "orderId y status requeridos" }, { status: 400 });
  }

  const { cancellationReason } = body;

  const order = await prisma.onlineOrder.findUnique({
    where: { id: body.orderId },
    select: { id: true, restaurantId: true, status: true, customerName: true, customerEmail: true, total: true, orderType: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const allowed = await verifyAccess(req, order.restaurantId);
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const validNext = TRANSITIONS[order.status] ?? [];
  if (!validNext.includes(body.status)) {
    return NextResponse.json({ error: `No se puede pasar de ${order.status} a ${body.status}` }, { status: 422 });
  }

  if (body.status === "CANCELLED" && (!cancellationReason || typeof cancellationReason !== "string" || !cancellationReason.trim())) {
    return NextResponse.json({ error: "Se requiere el motivo de cancelación" }, { status: 422 });
  }

  // Fetch current statusHistory to append new entry
  const orderFull = await prisma.onlineOrder.findUnique({ where: { id: order.id }, select: { statusHistory: true } });
  const history: { status: string; ts: string }[] = Array.isArray(orderFull?.statusHistory) ? (orderFull!.statusHistory as any) : [];
  history.push({ status: body.status, ts: new Date().toISOString() });

  const updated = await prisma.onlineOrder.update({
    where: { id: order.id },
    data: {
      status: body.status,
      statusHistory: history,
      ...(body.status === "CANCELLED" && cancellationReason ? { cancellationReason: cancellationReason.trim() } : {}),
    },
  });

  // Correo al cliente: solo al aceptar el pedido (con link de seguimiento en vivo).
  // IN_DELIVERY y READY ya no disparan correo — el cliente lo ve en el tracking.
  if (body.status === "ACCEPTED" && order.customerEmail) {
    void sendOrderStatusEmail(order.id, body.status);
  }

  // Al completarse el pedido, enviar encuesta de satisfacción si tiene email.
  if (body.status === "DONE" && order.customerEmail) {
    const toEmail = order.customerEmail;
    void (async () => {
      try {
        const rest = await prisma.restaurant.findUnique({
          where: { id: order.restaurantId },
          select: { name: true, logoUrl: true, cartaAccentColor: true, ecommerceStoreConfig: true },
        });
        if (!rest) return;
        const cfg = parseStoreConfig(rest.ecommerceStoreConfig as any, { accent: rest.cartaAccentColor });
        const link = `${storeAbsBase({ customDomain: (cfg as any).customDomain })}/encuesta/${order.id}`;
        const ok = await sendSurveyEmail({
          to: toEmail,
          link,
          storeName: rest.name,
          logoUrl: rest.logoUrl,
          accent: (cfg as any).primaryColor,
          customerName: order.customerName,
          survey: (cfg as any).survey,
        });
        if (ok) await prisma.onlineOrder.update({ where: { id: order.id }, data: { surveySentAt: new Date() } }).catch(() => {});
      } catch {}
    })();
  }

  return NextResponse.json({ order: updated });
}
