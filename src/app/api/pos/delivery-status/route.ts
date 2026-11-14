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
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { getDelifastCodigoOrigen } from "@/lib/delifast/client";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";
import { STAGE_ORDER, toOpsStage } from "@/lib/delifast/status";

// Captura de depuración: guarda el cuerpo CRUDO de los últimos webhooks en un
// PlatformSetting (ring buffer) para poder inspeccionar exactamente qué manda
// Delifast. Solo corre si el flag "delifast_webhook_debug" === "1". No rompe
// nunca el webhook (todo en try/catch). Guarda sin el `secret`.
const WEBHOOK_LOG_MAX = 50;
async function captureWebhook(body: Record<string, unknown>): Promise<void> {
  try {
    if ((await getPlatformSetting("delifast_webhook_debug")) !== "1") return;
    const { secret, ...safe } = body; void secret;
    let arr: unknown[] = [];
    try { arr = JSON.parse((await getPlatformSetting("delifast_webhook_log")) || "[]"); } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    arr.push({ at: new Date().toISOString(), body: safe });
    if (arr.length > WEBHOOK_LOG_MAX) arr = arr.slice(-WEBHOOK_LOG_MAX);
    await setPlatformSetting("delifast_webhook_log", JSON.stringify(arr));
  } catch { /* nunca afecta al webhook */ }
}

// Cache negativo: id_venta de Delifast que NO corresponde a un pedido nuestro
// (codigo_origen vacío). Evita re-consultar el detalle en cada evento repetido.
const notOursVenta = new Map<string, number>();
const NOT_OURS_TTL = 15 * 60 * 1000;

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

// Construye el objeto de seguimiento (DelifastTracking) desde el webhook de
// Delifast, si trae los datos ricos (repartidor, ETA, PIN, ubicación, foto de
// entrega, timestamps). Tolerante: acepta objeto anidado o campos sueltos.
function trackingFromWebhook(body: Record<string, unknown>, meta: { idVenta: string | null; estado?: string | null }): Record<string, unknown> | null {
  const g = (k: string) => body[k];
  const rep = (body.repartidor && typeof body.repartidor === "object" ? body.repartidor : {}) as Record<string, unknown>;
  const ubi = (body.ubicacion && typeof body.ubicacion === "object" ? body.ubicacion : {}) as Record<string, unknown>;
  const ts = (body.timestamps && typeof body.timestamps === "object" ? body.timestamps : {}) as Record<string, unknown>;
  const s = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
  const num = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);

  const driverName = s(rep.nombre ?? g("repartidor_nombre") ?? (typeof g("repartidor") === "string" ? g("repartidor") : null));
  const driverPhone = s(rep.telefono ?? g("repartidor_telefono") ?? g("telefono"));
  const driverPhoto = s(rep.foto ?? g("repartidor_foto") ?? g("foto"));
  const lat = num(ubi.lat ?? g("lat"));
  const lng = num(ubi.lng ?? g("lng"));
  // ETA al LOCAL (recoger) y ETA al CLIENTE (entregar). Aceptamos varios nombres
  // (minutos, "HH:MM" o timestamp — etaMinutes() los normaliza). OJO: pasamos el
  // valor crudo, sin " min", porque etaMinutes solo parsea número/hora/timestamp.
  // Delifast manda UN solo `eta` (minutos al próximo destino). Si el repartidor ya
  // va al cliente (estado "En Camino" o hay timestamp en_camino), ese ETA es al
  // CLIENTE → va a dropoffEta (el pill muestra "Entrega en X min"); si todavía va
  // al local, es el ETA al local. Un eta_cliente explícito, si viene, manda.
  const rawEta = s(g("eta") ?? g("eta_min") ?? g("minutos") ?? g("eta_local") ?? g("pickup_eta") ?? g("minutos_llegada_local"));
  const explicitDropoffEta = s(g("eta_cliente") ?? g("eta_casa") ?? g("dropoff_eta") ?? g("eta_dropoff") ?? g("minutos_llegada_casa"));
  const towardClient = /camino|reparto|ruta|dropoff|transit/.test((meta.estado || "").toLowerCase()) || !!s(ts.en_camino ?? ts.dropoff);
  const eta = towardClient ? null : rawEta;
  const dropoffEta = explicitDropoffEta ?? (towardClient ? rawEta : null);
  const pin = s(g("pin") ?? g("pincode"));
  const pod = s(g("foto_entrega") ?? g("dropoff_imagen"));
  const url = s(g("url_seguimiento") ?? g("url_status"));

  const hasAny = driverName || driverPhone || driverPhoto || lat != null || eta || dropoffEta || pin || pod || url || Object.keys(ts).length;
  if (!hasAny) return null;

  return {
    idVenta: meta.idVenta,
    status: s(meta.estado) ?? null,
    eta, dropoffEta, pin,
    driver: (driverName || driverPhone || driverPhoto) ? { name: driverName, photo: driverPhoto, phone: driverPhone } : null,
    location: lat != null && lng != null ? { lat, lng, at: new Date().toISOString() } : null,
    deliveryPhoto: pod,
    statusUrl: url,
    timeline: {
      confirmacion: s(ts.asignado ?? ts.confirmada), inicioPickup: s(ts.recogido ?? ts.pickup), llegadaLocal: s(ts.en_local ?? ts.llegada_local),
      inicioDropoff: s(ts.en_camino ?? ts.dropoff),
      // "Llegó al cliente": el pill lo usa para distinguir "va en camino" de "ya llegó".
      llegadaCasa: s(ts.llegada_cliente ?? ts.en_cliente ?? ts.llegada_casa ?? g("llegada_cliente")),
      entregado: s(ts.entregado), cancelado: s(ts.cancelado),
    },
    source: "webhook",
  };
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

  // Depuración opcional: capturar el payload crudo (flag delifast_webhook_debug).
  await captureWebhook(body);

  // El id del local puede venir como `local`, `localId` o `local_id` (número o
  // texto). Lo necesitamos para saber a QUÉ restaurante pertenece el codigo_origen
  // (que es nuestro orderNumber y NO es único entre locales).
  const rawLocal = body.local ?? body.localId ?? body.local_id;
  const localStr = rawLocal != null && String(rawLocal).trim() !== "" ? String(rawLocal).trim() : undefined;
  const restaurantId =
    (typeof body.restaurantId === "string" && body.restaurantId) ||
    restaurantFromLocal(localStr);
  if (!restaurantId) {
    return NextResponse.json(
      {
        error: "No pude mapear el local a un restaurante",
        receivedLocal: localStr ?? null,
        hint: "Envía el id de tu local en el campo \"local\" y avísanos ese valor para mapearlo (DELIFAST_LOCAL_MAP).",
      },
      { status: 400 },
    );
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

  // 3) Resolución EXACTA por codigo_origen: consultamos el detalle de la venta en
  //    Delifast (que SÍ tiene el codigo_origen = nuestro orderNumber, aunque el
  //    evento lo mande vacío) y emparejamos por orderNumber. Reemplaza al antiguo
  //    match por nombre de cliente, que causaba falsos positivos.
  const negKey = `${restaurantId}:${idVenta}`;
  const negAt = notOursVenta.get(negKey);
  // Si la sincronización está pausada desde /admin/ajustes, NO raspamos Delifast
  // para resolver (solo se matchea por id_venta/codigo_origen, que no consultan nada).
  const paused = !po && idVenta && !(negAt && Date.now() - negAt < NOT_OURS_TTL)
    ? (await getPlatformSetting("delifast_tracking_paused")) === "1"
    : false;
  if (!po && !paused && idVenta && !(negAt && Date.now() - negAt < NOT_OURS_TTL)) {
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } });
    const creds = decryptEcommerceSecrets(parseEcommerceConfig(r?.ecommerceConfig)).delifast;
    if (creds?.enabled && creds.email && creds.password && creds.plataforma) {
      const co = await getDelifastCodigoOrigen(restaurantId, creds, idVenta).catch(() => null);
      const num = co != null && String(co).trim() !== "" ? Number(co) : null;
      if (num != null && Number.isFinite(num)) {
        const oo = await prisma.onlineOrder.findFirst({ where: { restaurantId, orderNumber: num }, orderBy: { createdAt: "desc" }, select: { id: true } });
        if (oo) {
          po = await prisma.posOrder.findFirst({
            where: { restaurantId, externalId: `oo-${oo.id}`, isDelivery: true },
            select: { id: true, restaurantId: true, externalId: true, opsStage: true, delifastVentaId: true },
          });
        }
      }
      if (!po) notOursVenta.set(negKey, Date.now()); // no es nuestro / no se resolvió
    }
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

  // Seguimiento rico (si el webhook lo trae) → se persiste y el POS lo lee de la BD
  // sin raspar el panel de Delifast.
  const rich = trackingFromWebhook(body, { idVenta, estado });
  if (rich) {
    patch.delifastTracking = rich as object;
    patch.delifastStatus = estado ?? (rich.status as string | null) ?? null;
    patch.delifastTrackedAt = now;
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
