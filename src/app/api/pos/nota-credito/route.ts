// ═══════════════════════════════════════════════════════════
//  Emite una NOTA DE CRÉDITO (61) que ANULA la boleta/factura de una venta.
//  - Factura (33): el receptor se reutiliza del documento original.
//  - Boleta (39): el SII NO acepta NC a consumidor final → el cajero debe
//    ingresar el RUT real del cliente (razón social, giro, dirección, comuna).
//  Idempotente por `nc-<posOrderId>` (una NC por venta). Devuelve el PDF (carta).
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { emitNotaCredito, type B2BReceptor } from "@/lib/sharkpos/client";
import { buildLines, restaurantSharkposCred, readFacturaReceptor } from "@/lib/sharkpos/emit-sale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

function fechaSiiChile(d: Date): string {
  const s = new Date(d.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const posOrderId = String(body.posOrderId || "");
  if (!posOrderId) return NextResponse.json({ error: "Falta posOrderId" }, { status: 400 });

  const order = await prisma.posOrder.findUnique({
    where: { id: posOrderId },
    select: {
      id: true, restaurantId: true, totalAmount: true, deliveryFee: true, items: true, rawPayload: true,
      orderReference: true, externalId: true,
      boletaDteId: true, boletaFolio: true, boletaEmittedAt: true, fiscalDocType: true,
      notaCreditoDteId: true,
      restaurant: { select: { sharkposEnabled: true, toteatWebhookSecret: true, sharkposApiKey: true, sharkposTenantEnv: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!(await assertOwnership(req, order.restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  if (!order.restaurant?.sharkposEnabled || order.restaurant.toteatWebhookSecret)
    return NextResponse.json({ error: "El local no emite por SharkPOS" }, { status: 400 });
  if (!order.boletaDteId || !order.boletaFolio)
    return NextResponse.json({ error: "La venta no tiene boleta/factura emitida para anular" }, { status: 400 });
  if (order.notaCreditoDteId)
    return NextResponse.json({ error: "La venta ya tiene una nota de crédito", already: true }, { status: 409 });

  const docType = order.fiscalDocType || 39;

  // Receptor de la NC: factura → el del documento; boleta → el que ingresa el cajero.
  let receptor: B2BReceptor | null = null;
  if (docType === 33) {
    receptor = readFacturaReceptor(order.rawPayload);
    if (!receptor) return NextResponse.json({ error: "No se encontraron los datos de receptor de la factura" }, { status: 400 });
  } else {
    const rc = (body.receptor || {}) as Record<string, any>;
    const s = (k: string) => String(rc[k] ?? "").trim();
    const rut = s("rut");
    if (!rut || /^66\.?666\.?666-?6$/i.test(rut))
      return NextResponse.json({ error: "Para anular una boleta, ingresa el RUT real del cliente (no consumidor final)" }, { status: 400 });
    if (!s("name") || !s("giro") || !s("direccion") || !s("comuna"))
      return NextResponse.json({ error: "Faltan datos del receptor: razón social, giro, dirección y comuna" }, { status: 400 });
    receptor = { rut, name: s("name"), giro: s("giro"), direccion: s("direccion"), comuna: s("comuna"), ciudad: s("ciudad") || undefined };
  }

  const total = order.totalAmount || 0;
  const ref = order.orderReference || order.externalId || order.id.slice(-6);
  const { lines } = buildLines(order.items, total, `Venta ${ref}`, order.deliveryFee || 0);
  const motivo = String(body.motivo || "").trim() || "Anulación de venta";
  const cred = restaurantSharkposCred(order.restaurant);

  try {
    const r = await emitNotaCredito({
      idempotencyKey: `nc-${order.id}`,
      receptor,
      items: lines,
      ref: { documentType: docType, folio: order.boletaFolio, date: fechaSiiChile(order.boletaEmittedAt || new Date()), code: 1, reason: motivo.slice(0, 90) },
    }, cred);

    if (!r.dteId) {
      console.error("[sharkpos] NC no emitida", order.id, r.httpStatus, r.code, r.message);
      return NextResponse.json({ error: r.message || r.code || `SharkPOS respondió ${r.httpStatus}`, code: r.code }, { status: 400 });
    }

    // Guardar receptor + motivo de la NC junto al pedido (para historial).
    const raw = (order.rawPayload && typeof order.rawPayload === "object" && !Array.isArray(order.rawPayload))
      ? { ...(order.rawPayload as Record<string, unknown>) } : {};
    raw.notaCredito = { receptor, motivo, at: new Date().toISOString() };

    await prisma.posOrder.update({
      where: { id: order.id },
      data: {
        notaCreditoDteId: r.dteId,
        notaCreditoFolio: r.folio ?? null,
        notaCreditoStatus: r.publicStatus || r.dteStatus || r.status || "emitida",
        notaCreditoPdfUrl: r.links?.pdf || r.pdfUrl || null,
        notaCreditoEmittedAt: new Date(),
        anuladaAt: new Date(),
        rawPayload: raw as any,
      },
    });

    return NextResponse.json({ ok: true, folio: r.folio, dteId: r.dteId, pdfBase64: r.pdfBase64 || null, docType });
  } catch (e) {
    console.error("[sharkpos] nota-credito", order.id, String(e));
    return NextResponse.json({ error: "Error al emitir la nota de crédito" }, { status: 500 });
  }
}
