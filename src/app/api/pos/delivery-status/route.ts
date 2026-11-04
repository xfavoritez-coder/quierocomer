// ═══════════════════════════════════════════════════════════
//  Webhook de estado de reparto externo (Delifast).
//  Lo llama nuestro worker que escucha el Pusher de Delifast
//  (evento `cambio-estado` en el canal local-<id>). Delifast NO
//  manda el orderNumber en el evento (codigo_origen viene vacío);
//  manda id_venta + cliente + nuevo_estado. Por eso resolvemos el
//  pedido por: delifastVentaId guardado → orderNumber → cliente+reciente.
//
//  Mapeo de estados Delifast → opsStage:
//    "En Camino" / reparto / retirado / despachado → out_for_delivery
//    "Entregada" / "Entregado"                      → delivered
//  (los demás se ignoran). Solo avanza hacia adelante, nunca retrocede.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOnlineOrderFromPos } from "@/lib/ecommerce/syncOnlineFromPos";

const STAGE_ORDER: Record<string, number> = { preparing: 0, ready: 1, out_for_delivery: 2, delivered: 3 };

// Mapa opcional id de local Delifast → restaurantId nuestro (JSON en env).
function restaurantFromLocal(localId?: string | null): string | null {
  if (!localId) return null;
  try {
    const map = JSON.parse(process.env.DELIFAST_LOCAL_MAP || "{}") as Record<string, string>;
    return map[String(localId)] ?? null;
  } catch {
    return null;
  }
}

function toOpsStage(estado?: string | null): string | null {
  const e = (estado || "").toLowerCase();
  if (/entregad/.test(e)) return "delivered";
  if (/camino|reparto|retirad|despach|ruta/.test(e)) return "out_for_delivery";
  return null; // confirmada / asignado / otros → no cambia opsStage
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Auth por secreto compartido (solo nuestro worker lo conoce).
  const secret = process.env.DELIFAST_WEBHOOK_SECRET;
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const restaurantId =
    (typeof body.restaurantId === "string" && body.restaurantId) ||
    restaurantFromLocal(body.localId as string | undefined);
  if (!restaurantId) {
    return NextResponse.json({ error: "Falta restaurantId (o localId mapeable)" }, { status: 400 });
  }

  const estado = (body.estado ?? body.nuevo_estado) as string | undefined;
  const idVenta = (body.idVenta ?? body.id_venta) ? String(body.idVenta ?? body.id_venta) : null;
  const orderNumberRaw = body.orderNumber ?? body.codigo_origen;
  const orderNumber = orderNumberRaw != null && String(orderNumberRaw).trim() !== "" ? Number(orderNumberRaw) : null;
  const cliente = (body.cliente ?? body.customerName) as string | undefined;

  // Nota: resolvemos el pedido SIEMPRE (incluso en estados que no avanzan el
  // opsStage, como "Confirmada"/"Asignado") para guardar el delifastVentaId
  // temprano — así el POS puede traer el seguimiento enriquecido apenas Delifast
  // confirma, sin esperar al "En Camino".
  const nextStage = toOpsStage(estado);

  // ── Resolver el PosOrder ──────────────────────────────────
  type PO = { id: string; restaurantId: string; externalId: string; opsStage: string; delifastVentaId: string | null };
  let po: PO | null = null;

  // Delifast SOLO despacha pedidos de delivery → sus eventos nunca deben tocar un
  // pedido de retiro. isDelivery:true en todos los match evita falsos positivos
  // (p. ej. un despacho de "Romina" emparejado por nombre con un retiro de "Romina").

  // 1) Match exacto por id_venta ya guardado (eventos repetidos del mismo pedido).
  if (idVenta) {
    po = await prisma.posOrder.findFirst({
      where: { restaurantId, delifastVentaId: idVenta, isDelivery: true },
      select: { id: true, restaurantId: true, externalId: true, opsStage: true, delifastVentaId: true },
    });
  }

  // 2) Por orderNumber (si Delifast lo mandara) vía OnlineOrder → externalId "oo-<id>".
  if (!po && orderNumber != null && Number.isFinite(orderNumber)) {
    const oo = await prisma.onlineOrder.findFirst({
      where: { restaurantId, orderNumber },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (oo) {
      po = await prisma.posOrder.findFirst({
        where: { restaurantId, externalId: `oo-${oo.id}`, isDelivery: true },
        select: { id: true, restaurantId: true, externalId: true, opsStage: true, delifastVentaId: true },
      });
    }
  }

  // 3) Último recurso: por nombre de cliente, pedido de DELIVERY activo reciente (12 h).
  if (!po && cliente) {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
    po = await prisma.posOrder.findFirst({
      where: {
        restaurantId,
        isDelivery: true,
        createdAt: { gte: since },
        customerName: { equals: cliente, mode: "insensitive" },
        opsStage: { not: "delivered" },
        posStatus: { not: "canceled" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, restaurantId: true, externalId: true, opsStage: true, delifastVentaId: true },
    });
  }

  if (!po) {
    return NextResponse.json({ ok: false, matched: false, reason: "pedido no encontrado", idVenta, orderNumber, cliente }, { status: 200 });
  }

  // Guardar el id_venta para que los próximos eventos hagan match exacto.
  const patch: Record<string, unknown> = {};
  if (idVenta && po.delifastVentaId !== idVenta) patch.delifastVentaId = idVenta;

  // Solo avanzar hacia adelante (nunca retroceder un estado). nextStage puede ser
  // null en estados que no mapean (Confirmada/Asignado): ahí no se toca opsStage,
  // pero sí se guarda el delifastVentaId de arriba.
  const cur = STAGE_ORDER[po.opsStage] ?? 0;
  const nxt = nextStage ? (STAGE_ORDER[nextStage] ?? 0) : 0;
  const now = new Date();
  let stageChanged = false;
  if (nextStage && nxt > cur) {
    patch.opsStage = nextStage;
    stageChanged = true;
    if (nextStage === "out_for_delivery") patch.opsDispatchedAt = now;
    if (nextStage === "delivered") patch.opsDeliveredAt = now;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, matched: true, orderId: po.id, noChange: true, opsStage: po.opsStage, estado }, { status: 200 });
  }

  const updated = await prisma.posOrder.update({
    where: { id: po.id },
    data: patch,
    select: { restaurantId: true, externalId: true, opsStage: true, posStatus: true },
  });

  // Sincroniza OnlineOrder.status + push al cliente SOLO si cambió el estado
  // (no cuando solo guardamos el delifastVentaId).
  if (stageChanged) void syncOnlineOrderFromPos(updated).catch(() => {});

  return NextResponse.json(
    { ok: true, matched: true, orderId: po.id, opsStage: updated.opsStage, savedVentaId: !!patch.delifastVentaId, estado },
    { status: 200 },
  );
}
