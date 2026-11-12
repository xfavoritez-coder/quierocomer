// ═══════════════════════════════════════════════════════════
//  PDF carta (base64) de un documento B2B de una venta: la FACTURA (33) o su
//  NOTA DE CRÉDITO (61). La boleta térmica va por /api/pos/boleta-print.
//  GET ?posOrderId=...&kind=factura|nc
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { getB2BPdfBase64 } from "@/lib/sharkpos/client";
import { restaurantSharkposCred } from "@/lib/sharkpos/emit-sale";

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

export async function GET(req: NextRequest) {
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  const kind = req.nextUrl.searchParams.get("kind") || "factura";
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

  const dteId = kind === "nc" ? order.notaCreditoDteId : (order.fiscalDocType === 33 ? order.boletaDteId : null);
  const folio = kind === "nc" ? order.notaCreditoFolio : order.boletaFolio;
  if (!dteId) return NextResponse.json({ error: kind === "nc" ? "Sin nota de crédito" : "La venta no es una factura" }, { status: 400 });

  const cred = restaurantSharkposCred(order.restaurant);
  const pdfBase64 = await getB2BPdfBase64(dteId, cred);
  if (!pdfBase64) return NextResponse.json({ ready: false, reason: "PDF no disponible aún" }, { status: 200 });
  return NextResponse.json({ ready: true, pdfBase64, folio, kind });
}
