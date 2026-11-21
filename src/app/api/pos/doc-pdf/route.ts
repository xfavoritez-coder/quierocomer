// ═══════════════════════════════════════════════════════════
//  PDF de un documento tributario de una venta del POS:
//   - boleta (39) → PDF térmico 80mm desde SharkPOS
//   - factura (33) → PDF carta B2B
//   - nc → nota de crédito (PDF carta B2B)
//  GET ?posOrderId=...&kind=boleta|factura|nc
//    · sin dl → JSON { ready, pdfBase64, folio }  (compat.)
//    · &dl=1 → responde el PDF directo (application/pdf) para abrirlo en una
//      pestaña nueva; iOS Safari NO abre blobs en pestañas nuevas (da "Load
//      failed"), así que la descarga del POS usa esta ruta directa.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { getB2BPdfBase64, getBoletaPdfBase64 } from "@/lib/sharkpos/client";
import { restaurantSharkposCred } from "@/lib/sharkpos/emit-sale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La descarga del PDF desde SharkPOS tiene timeout de 25s; damos margen para que
// un pico de latencia no corte la función a mitad (que el cliente ve como "Load failed").
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

// Página mínima para el modo dl cuando no hay PDF (en vez de mostrar JSON crudo).
function htmlMsg(msg: string): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;color:#333;background:#f5f5f7;text-align:center;padding:24px"><div>${msg}</div></body>`;
}

export async function GET(req: NextRequest) {
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  const kind = req.nextUrl.searchParams.get("kind") || "factura";
  const dl = req.nextUrl.searchParams.get("dl") === "1";
  if (!posOrderId) return NextResponse.json({ error: "Falta posOrderId" }, { status: 400 });

  const order = await prisma.posOrder.findUnique({
    where: { id: posOrderId },
    select: {
      restaurantId: true, boletaDteId: true, fiscalDocType: true, boletaFolio: true,
      notaCreditoDteId: true, notaCreditoFolio: true,
      restaurant: { select: { sharkposApiKey: true, sharkposTenantEnv: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!(await assertOwnership(req, order.restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const cred = restaurantSharkposCred(order.restaurant);
  let pdfBase64: string | undefined;
  let folio: number | null = null;
  let badReq: string | null = null; // dato inválido (400)

  if (kind === "boleta") {
    folio = order.boletaFolio ?? null;
    if (!order.boletaDteId) badReq = "La venta no tiene boleta emitida";
    else pdfBase64 = await getBoletaPdfBase64(order.boletaDteId, 80, cred);
  } else {
    const dteId = kind === "nc" ? order.notaCreditoDteId : (order.fiscalDocType === 33 ? order.boletaDteId : null);
    folio = kind === "nc" ? (order.notaCreditoFolio ?? null) : (order.boletaFolio ?? null);
    if (!dteId) badReq = kind === "nc" ? "Sin nota de crédito" : "La venta no es una factura";
    else pdfBase64 = await getB2BPdfBase64(dteId, cred);
  }
  const notReady = !badReq && !pdfBase64;

  if (dl) {
    if (badReq) return new NextResponse(htmlMsg(badReq), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (notReady) return new NextResponse(htmlMsg("El PDF aún no está disponible. Intenta de nuevo en unos segundos."), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    const bytes = Buffer.from(pdfBase64!, "base64");
    const fnameBase = kind === "nc" ? "nota-credito" : kind === "boleta" ? "boleta" : "factura";
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fnameBase}-${folio || posOrderId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Modo JSON (compatibilidad).
  if (badReq) return NextResponse.json({ error: badReq }, { status: 400 });
  if (notReady) return NextResponse.json({ ready: false, reason: "PDF no disponible aún" }, { status: 200 });
  return NextResponse.json({ ready: true, pdfBase64, folio, kind });
}
