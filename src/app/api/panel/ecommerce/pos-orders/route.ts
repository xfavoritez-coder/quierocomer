import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOnlineOrderFromPos } from "@/lib/ecommerce/syncOnlineFromPos";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";
import { dailyOrderNumbers } from "@/lib/kds/dailyNumber";
import { parseDeliveryConfig } from "@/lib/ecommerce/delivery";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { parseEcommerceConfig, integrationStatus } from "@/lib/ecommerce/config";
import { mirrorOnlineOrderToCentro } from "@/lib/ecommerce/centroMirror";
import { markUberOrderReady } from "@/lib/ubereats/client";

// Auto-reparación del espejo: espeja al Centro cualquier OnlineOrder activo
// reciente que no tenga su PosOrder (p. ej. si el espejo falló transitoriamente
// al confirmarse el pago). Throttle por local para no correr en cada poll.
const lastBackfill = new Map<string, number>();
async function backfillMirror(restaurantId: string): Promise<void> {
  if (Date.now() - (lastBackfill.get(restaurantId) ?? 0) < 25_000) return;
  lastBackfill.set(restaurantId, Date.now());
  const since = new Date(Date.now() - 6 * 3600_000);
  const oos = await prisma.onlineOrder.findMany({
    where: {
      restaurantId, source: "ecommerce", createdAt: { gte: since },
      status: { in: ["ACCEPTED", "PREPARING", "READY", "IN_DELIVERY"] },
    },
    select: { id: true },
    take: 60,
  });
  if (!oos.length) return;
  const existing = new Set(
    (await prisma.posOrder.findMany({
      where: { restaurantId, externalId: { in: oos.map((o) => `oo-${o.id}`) } },
      select: { externalId: true },
    })).map((p) => p.externalId),
  );
  const missing = oos.filter((o) => !existing.has(`oo-${o.id}`));
  for (const o of missing) await mirrorOnlineOrderToCentro(o.id, "web").catch(() => {});
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

const STAGES = ["preparing", "ready", "out_for_delivery", "delivered"];

/** GET /api/panel/ecommerce/pos-orders?restaurantId=X[&scope=activos|historial]
 *  Lista los pedidos del POS del local (Centro de pedidos). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope") || "activos";

  // Rango de fechas (YYYY-MM-DD en hora de Chile). Por defecto: hoy.
  const today = chileTodayYmd();
  const fromYmd = req.nextUrl.searchParams.get("from") || today;
  const toYmd = req.nextUrl.searchParams.get("to") || fromYmd;
  const start = chileDayRangeUtc(fromYmd).start;
  const end = chileDayRangeUtc(toYmd).end;
  const dateRange = { gte: start, lte: end };

  const where: any = { restaurantId };
  if (scope === "kds") {
    // KDS de cocina: Pendientes = en preparación (siempre, trabajo en curso);
    // Completados = los que SALIERON de preparación dentro del rango, por FECHA DE
    // COMPLETADO (no de creación). La hora de completado es cuando pasó a "listo"
    // (opsReadyForDeliveryAt), o entregado/completado si no la tiene.
    const doneInRange = {
      OR: [
        { opsReadyForDeliveryAt: dateRange },
        { opsReadyForDeliveryAt: null, opsDeliveredAt: dateRange },
        { opsReadyForDeliveryAt: null, opsDeliveredAt: null, completedAt: dateRange },
      ],
    };
    where.AND = [
      { posStatus: { not: "canceled" } },
      { OR: [{ opsStage: "preparing" }, { AND: [{ opsStage: { not: "preparing" } }, doneInRange] }] },
    ];
  } else if (scope === "historial") {
    // Historial: entregados/cancelados creados dentro del rango.
    where.createdAt = dateRange;
    where.OR = [{ opsStage: "delivered" }, { posStatus: "canceled" }];
  } else if (scope === "pagados") {
    // Pagados: todos los pedidos con pago (web o POS), sin importar la etapa.
    // Lo usa la caja del POS para reconciliar el arqueo del turno.
    where.createdAt = dateRange;
    where.posStatus = { not: "canceled" };
    where.paidAmount = { gt: 0 };
  } else {
    // Activos: los pedidos en curso (preparación/listo/reparto) + los que ya
    // fueron entregados pero siguen IMPAGOS. Estos últimos no se pierden: quedan
    // en su pestaña normal (Todos/Retiro/Delivery) con el aviso de cobro, hasta
    // que se cobren. Los entregados YA pagados viven en el historial. El filtro
    // final paidAmount < totalAmount se hace en JS (Prisma no compara columnas).
    where.posStatus = { not: "canceled" };
    where.OR = [
      { opsStage: { not: "delivered" } },
      { opsStage: "delivered", totalAmount: { gt: 0 }, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    ];
  }

  // Antes de listar el board de activos, auto-repara el espejo (crea los PosOrder
  // de pedidos activos que se hayan quedado sin espejar). Se espera para que
  // aparezcan en esta misma respuesta.
  if (scope === "activos") await backfillMirror(restaurantId).catch(() => {});

  const orders = await prisma.posOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: scope === "historial" ? 300 : 400,
  });

  // Ubicación del local (origen de despacho) para el mini-mapa en vivo de la tarjeta.
  const rLoc = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { lat: true, lng: true, ecommerceDeliveryConfig: true, ecommerceStoreConfig: true, ecommerceConfig: true } });
  // ¿El local usa Delifast? Si no, el POS no consulta el seguimiento al entregar.
  const delifastEnabled = integrationStatus(parseEcommerceConfig(rLoc?.ecommerceConfig)).delifast;
  const dCfg = parseDeliveryConfig(rLoc?.ecommerceDeliveryConfig);
  const localLat = dCfg.origin?.lat ?? rLoc?.lat ?? null;
  const localLng = dCfg.origin?.lng ?? rLoc?.lng ?? null;
  // Tiempos configurados (incluye el del repartidor, que pedimos exponer en el JSON).
  const storeCfg = parseStoreConfig(rLoc?.ecommerceStoreConfig);
  const driverTime = storeCfg.waitTimeDriver || "";
  const pickupTime = storeCfg.waitTimePickup || "";
  const deliveryTime = storeCfg.waitTimeDelivery || "";

  // KDS: número de pedido corto que se reinicia cada día (para control por teclado).
  if (scope === "kds") {
    const nums = await dailyOrderNumbers(restaurantId, orders.map((o) => ({ id: o.id, createdAt: o.createdAt })));
    const withNum = orders.map((o) => ({ ...o, dailyNumber: nums[o.id] ?? null, driverTime, pickupTime, deliveryTime }));
    return NextResponse.json({ orders: withNum, from: fromYmd, to: toYmd, today, localLat, localLng, driverTime, pickupTime, deliveryTime });
  }

  // Activos: deja fuera los entregados que YA están pagados (esos van al
  // historial); conserva los entregados impagos (cobro pendiente) y todo lo demás.
  const visible = scope === "activos"
    ? orders.filter((o) => o.opsStage !== "delivered" || (o.paidAmount || 0) < (o.totalAmount || 0))
    : orders;
  const nums = await dailyOrderNumbers(restaurantId, visible.map((o) => ({ id: o.id, createdAt: o.createdAt })));
  const ordersOut = visible.map((o) => ({ ...o, dailyNumber: nums[o.id] ?? null, driverTime, pickupTime, deliveryTime }));
  return NextResponse.json({ orders: ordersOut, from: fromYmd, to: toYmd, today, localLat, localLng, driverTime, pickupTime, deliveryTime, delifastEnabled });
}

/** PATCH /api/panel/ecommerce/pos-orders → avanza la etapa operativa de un pedido.
 *  Body: { restaurantId, id, opsStage } */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // ── Cobro desde el POS (chips Delivery/Retiro) ──────────────────────
  // Registra el pago sobre el PosOrder usando los campos existentes (sin tocar
  // el schema): paidAmount/tipAmount/changeAmount + el método en rawPayload.
  if (body?.action === "pay") {
    const method = String(body?.method || "").toLowerCase();
    if (!["efectivo", "debito", "credito", "transferencia", "webpay"].includes(method)) {
      return NextResponse.json({ error: "Método inválido" }, { status: 400 });
    }
    const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true, totalAmount: true, paidAmount: true, rawPayload: true } });
    if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const total = order.totalAmount || 0;
    // Idempotencia: si el pedido ya está cobrado completo, no re-escribir. Evita el
    // doble cobro por doble clic o por dos cajeras cobrando el mismo pedido a la vez.
    if (total > 0 && (order.paidAmount || 0) >= total) {
      const current = await prisma.posOrder.findUnique({ where: { id } });
      return NextResponse.json({ order: current, alreadyPaid: true });
    }
    const tip = Math.max(0, Math.round(Number(body?.tip) || 0));
    const received = method === "efectivo" ? Math.max(0, Math.round(Number(body?.received) || 0)) : total;
    const change = Math.max(0, received - total);
    const prevRaw = (order.rawPayload && typeof order.rawPayload === "object" && !Array.isArray(order.rawPayload))
      ? (order.rawPayload as Record<string, unknown>) : {};
    // Auditoría del cobro: método, montos, instante, quién lo registró (panel_id) y
    // el origen de la confirmación. Se guarda en rawPayload (sin tocar el schema).
    const by = req.cookies.get("panel_id")?.value || "caja";
    const rawPayload = { ...prevRaw, posPayment: { method, received, tip, change, at: new Date().toISOString(), by, origin: "caja", balance: 0 } };
    const updated = await prisma.posOrder.update({
      where: { id },
      data: { paidAmount: total, tipAmount: tip, changeAmount: change, rawPayload },
    });
    void syncOnlineOrderFromPos(updated).catch(() => {});
    return NextResponse.json({ order: updated });
  }

  // ── Anular pedido desde el POS (retiro/delivery) ───────────────────
  // Lo marca como cancelado (posStatus "canceled") → sale de los activos y pasa
  // al historial. Guarda el motivo en rawPayload. No borra el registro.
  if (body?.action === "cancel") {
    const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true, rawPayload: true } });
    if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const reason = String(body?.reason || "").trim().slice(0, 200);
    const prevRaw = (order.rawPayload && typeof order.rawPayload === "object" && !Array.isArray(order.rawPayload))
      ? (order.rawPayload as Record<string, unknown>) : {};
    const rawPayload = { ...prevRaw, posCancel: { reason: reason || "Anulado en el POS", at: new Date().toISOString() } };
    const updated = await prisma.posOrder.update({
      where: { id },
      data: { posStatus: "canceled", rawPayload },
    });
    void syncOnlineOrderFromPos(updated).catch(() => {});
    return NextResponse.json({ order: updated });
  }

  const opsStage = (body?.opsStage || "").toString();
  if (!STAGES.includes(opsStage)) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true, isDelivery: true, deliveryFee: true, provider: true, externalId: true, opsReadyForDeliveryAt: true, opsDispatchedAt: true, restaurant: { select: { centroPedidosConfig: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Un pedido con dirección pero sin monto de delivery se toma como retiro.
  const effectiveDelivery = order.isDelivery && (order.deliveryFee ?? 0) > 0;

  // Retiro + auto-entregar activado: al marcar "Listo" salta directo a "Entregado"
  // (los pedidos de retiro no tienen reparto; el cliente los retira al estar listos).
  let stage = opsStage;
  const cfg = order.restaurant?.centroPedidosConfig as { autoDeliverPickup?: boolean } | null;
  if (stage === "ready" && !effectiveDelivery && cfg?.autoDeliverPickup) stage = "delivered";

  // Timestamps de etapa (para el orden y los tiempos en la app del repartidor).
  const now = new Date();
  const data: any = { opsStage: stage };
  if (stage === "ready") data.opsReadyForDeliveryAt = order.opsReadyForDeliveryAt ?? now;
  if (stage === "out_for_delivery") data.opsDispatchedAt = order.opsDispatchedAt ?? now;
  if (stage === "delivered") {
    data.opsDeliveredAt = now;
    // Auto-entregado de retiro: deja marcado el "listo" para el registro de tiempos.
    if (opsStage === "ready") data.opsReadyForDeliveryAt = order.opsReadyForDeliveryAt ?? now;
  }
  // Si el local mueve un pedido "hacia atrás" a preparación, se libera la asignación.
  if (stage === "preparing" || stage === "ready") {
    data.assignedDriverId = null; data.assignedTo = null; data.isAssigned = false;
    if (stage === "preparing") data.opsReadyForDeliveryAt = null;
  }

  const updated = await prisma.posOrder.update({ where: { id }, data });
  void syncOnlineOrderFromPos(updated).catch(() => {});

  // Pedido de Uber Eats: al marcarlo "Listo" se avisa a Uber (markReady) para que
  // asigne el despacho. El id de Uber es el externalId sin el prefijo "ue-".
  if (stage === "ready" && order.provider === "ubereats" && order.externalId?.startsWith("ue-")) {
    void markUberOrderReady(order.externalId.slice(3)).catch((e) => console.error("[ubereats] ready:", (e as Error).message));
  }

  return NextResponse.json({ order: updated });
}

/** DELETE /api/panel/ecommerce/pos-orders?restaurantId=X&id=Y → elimina un pedido
 *  (útil para limpiar pruebas o descartar duplicados). */
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.posOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
