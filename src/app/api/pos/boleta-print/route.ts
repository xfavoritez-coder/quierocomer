// ═══════════════════════════════════════════════════════════
//  Datos para imprimir la boleta de una venta en la impresora de caja.
//  El navegador (POS) llama a este endpoint, arma el ESC/POS con escpos.ts y
//  lo manda al agente local (localhost:7777). Aquí NO se imprime: solo se reúne
//  folio + líneas + total + TED (para el PDF417). Si la boleta aún no se emitió
//  (emisión async al cobrar), devuelve { ready:false } para que el POS reintente.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { getBoletaTed, getBoletaTedPngBase64, getBoletaPdfBase64, sharkposEnv } from "@/lib/sharkpos/client";
import { buildLines } from "@/lib/sharkpos/emit-sale";
import { parseCentroPedidosConfig } from "@/lib/ecommerce/config";

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

function fechaChile(d: Date): string {
  const s = new Date(d.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(s.getDate())}/${p(s.getMonth() + 1)}/${s.getFullYear()} ${p(s.getHours())}:${p(s.getMinutes())}`;
}

export async function GET(req: NextRequest) {
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  if (!posOrderId) return NextResponse.json({ error: "Falta posOrderId" }, { status: 400 });

  const order = await prisma.posOrder.findUnique({
    where: { id: posOrderId },
    select: {
      id: true, restaurantId: true, totalAmount: true, deliveryFee: true, items: true,
      orderReference: true, externalId: true,
      boletaDteId: true, boletaFolio: true, boletaStatus: true, boletaEmittedAt: true, boletaPublicUrl: true,
      restaurant: { select: { name: true, sharkposEnabled: true, toteatWebhookSecret: true, centroPedidosConfig: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!(await assertOwnership(req, order.restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // El local no emite boletas por SharkPOS (no habilitado o usa Toteat) → el POS
  // no debe intentar imprimir ni reintentar.
  if (!order.restaurant?.sharkposEnabled || order.restaurant.toteatWebhookSecret) {
    return NextResponse.json({ ready: false, enabled: false });
  }

  // Boleta aún no emitida (la emisión corre async al cobrar) → el POS reintenta.
  if (!order.boletaDteId) {
    const failed = order.boletaStatus?.startsWith("error:");
    return NextResponse.json({ ready: false, enabled: true, failed: !!failed, reason: failed ? "emisión falló" : "emitiendo" });
  }

  // Timbre: PNG del PDF417 (para rasterizar en la caja) + TED XML (para el RUT emisor).
  // Si falla transitorio, que el POS reintente.
  let tedPngBase64: string | undefined;
  let pdfBase64: string | undefined;
  let emisorRut = "";
  try {
    const [ted, png, pdf] = await Promise.all([
      getBoletaTed(order.boletaDteId),
      getBoletaTedPngBase64(order.boletaDteId),
      getBoletaPdfBase64(order.boletaDteId, 80),
    ]);
    tedPngBase64 = png;
    pdfBase64 = pdf;
    const m = (ted.ted || "").match(/<RE>([^<]+)<\/RE>/i);
    if (m) emisorRut = m[1].trim();
  } catch {
    return NextResponse.json({ ready: false, reason: "TED no disponible" });
  }

  const total = order.totalAmount || 0;
  const ref = order.orderReference || order.externalId || order.id.slice(-6);
  const { lines } = buildLines(order.items, total, `Venta ${ref}`, order.deliveryFee || 0);
  const emi = parseCentroPedidosConfig(order.restaurant?.centroPedidosConfig).sharkposEmisor || {};

  return NextResponse.json({
    ready: true,
    boleta: {
      // PDF de SharkPOS (se imprime tal cual). Lo demás es respaldo por si falla el render.
      pdfBase64,
      folio: order.boletaFolio,
      fecha: fechaChile(order.boletaEmittedAt || new Date()),
      emisorName: emi.razonSocial || order.restaurant?.name || "",
      emisorRut,
      emisorGiro: emi.giro,
      emisorAddress: emi.direccion,
      siiOffice: emi.siiOffice,
      resolution: emi.resolucion,
      items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
      total,
      tedPngBase64,
      verifyUrl: order.boletaPublicUrl || undefined,
      sandbox: sharkposEnv() === "sandbox",
    },
  });
}
