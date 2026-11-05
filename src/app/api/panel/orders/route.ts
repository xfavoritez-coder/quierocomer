import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { sendOrderStatusEmail } from "@/lib/ecommerce/orderEmails";
import { sendSurveyEmail, storeAbsBase } from "@/lib/ecommerce/surveyEmail";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId.startsWith("tm_")) {
    return teamMemberCanAccess(panelId.slice(3), restaurantId);
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
    select: { id: true, restaurantId: true, status: true, customerName: true, customerEmail: true, total: true, orderType: true, deliveryFee: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const allowed = await verifyAccess(req, order.restaurantId);
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // `force` (herramienta de pruebas): permite fijar cualquier estado, incluso
  // retroceder, para re-probar notificaciones sin crear pedidos nuevos.
  const KNOWN_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY", "IN_DELIVERY", "DONE", "CANCELLED"];
  if (body.force === true) {
    if (!KNOWN_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Estado inválido: ${body.status}` }, { status: 422 });
    }
  } else {
    const validNext = TRANSITIONS[order.status] ?? [];
    if (!validNext.includes(body.status)) {
      return NextResponse.json({ error: `No se puede pasar de ${order.status} a ${body.status}` }, { status: 422 });
    }
  }

  if (body.status === "CANCELLED" && body.force !== true && (!cancellationReason || typeof cancellationReason !== "string" || !cancellationReason.trim())) {
    return NextResponse.json({ error: "Se requiere el motivo de cancelación" }, { status: 422 });
  }

  // Auto-entregar retiro: si el local activó "retiro → entregado al marcar Listo"
  // (centroPedidosConfig.autoDeliverPickup), marcar "Listo" un pedido de retiro
  // equivale a "Entregado" — misma regla que el botón del POS (pos.ts PATCH). El
  // entregado IMPAGO no se pierde del POS: el scope `activos` lo conserva hasta
  // que se cobre (se gestiona por paidAmount, no por la etapa).
  let effectiveStatus: string = body.status;
  if (body.status === "READY") {
    const rest = await prisma.restaurant.findUnique({ where: { id: order.restaurantId }, select: { centroPedidosConfig: true } });
    const cfg = (rest?.centroPedidosConfig && typeof rest.centroPedidosConfig === "object" && !Array.isArray(rest.centroPedidosConfig)
      ? rest.centroPedidosConfig : {}) as { autoDeliverPickup?: boolean };
    const effectiveDelivery = order.orderType === "DELIVERY" && (order.deliveryFee || 0) > 0;
    if (cfg.autoDeliverPickup && !effectiveDelivery) effectiveStatus = "DONE";
  }

  // Fetch current statusHistory to append new entry
  const orderFull = await prisma.onlineOrder.findUnique({ where: { id: order.id }, select: { statusHistory: true } });
  const history: { status: string; ts: string }[] = Array.isArray(orderFull?.statusHistory) ? (orderFull!.statusHistory as any) : [];
  history.push({ status: effectiveStatus, ts: new Date().toISOString() });

  const updated = await prisma.onlineOrder.update({
    where: { id: order.id },
    data: {
      status: effectiveStatus,
      statusHistory: history,
      ...(effectiveStatus === "CANCELLED" && cancellationReason ? { cancellationReason: cancellationReason.trim() } : {}),
    },
  });

  // Push al cliente (PWA) con el cambio de estado.
  void import("@/lib/ecommerce/orderStatusPush").then((m) => m.sendOrderStatusPush(order.id, effectiveStatus)).catch(() => {});

  // Reflejar el cambio en el espejo del POS / Centro de pedidos: así, gestione
  // quien gestione el pedido (este panel o el board del POS), el estado queda
  // igual en todas las pantallas.
  void import("@/lib/ecommerce/syncPosFromOnline").then((m) => m.syncPosOrderFromOnline(order.id, effectiveStatus)).catch(() => {});

  // Correo al cliente: solo al aceptar el pedido (con link de seguimiento en vivo).
  // IN_DELIVERY y READY ya no disparan correo — el cliente lo ve en el tracking.
  if (effectiveStatus === "ACCEPTED" && order.customerEmail) {
    void sendOrderStatusEmail(order.id, effectiveStatus);
  }

  // Al completarse el pedido, enviar encuesta de satisfacción si tiene email.
  if (effectiveStatus === "DONE" && order.customerEmail) {
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
