// ═══════════════════════════════════════════════════════════
//  Webhook de SharkPOS: resultado del SII para las boletas emitidas.
//  Verifica la firma (Standard Webhooks) sobre el cuerpo CRUDO, ubica la venta
//  por data.idempotency_key (`venta-<posOrderId>`) y actualiza su estado/folio/pdf.
//  Eventos: dte.accepted | dte.accepted_with_repair | dte.rejected |
//  dte.review_required | dte.failed. `data` = DocumentDetail del contrato.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySharkposSignature } from "@/lib/sharkpos/webhook";
import { sharkposAbsoluteUrl } from "@/lib/sharkpos/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 1) Verificar firma sobre el cuerpo crudo ANTES de parsear.
  const check = verifySharkposSignature(raw, req.headers);
  if (!check.ok) return NextResponse.json({ error: check.reason || "firma inválida" }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = JSON.parse(raw) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, any>;
  const idem = String(data.idempotency_key || "");
  const dteId = String(data.dte_id || "");

  // Solo boletas de ventas (key `venta-<posOrderId>`). Nunca mezclar entornos.
  const posOrderId = idem.startsWith("venta-") ? idem.slice("venta-".length) : null;
  if (!posOrderId && !dteId) {
    return NextResponse.json({ ok: true, ignored: "sin referencia" }, { status: 200 });
  }

  try {
    const target = posOrderId
      ? await prisma.posOrder.findUnique({ where: { id: posOrderId }, select: { id: true } })
      : await prisma.posOrder.findFirst({ where: { boletaDteId: dteId }, select: { id: true } });

    // Venta no nuestra (otro entorno / doc que no es de una venta) → 200, no reintentar.
    if (!target) return NextResponse.json({ ok: true, ignored: "venta no encontrada", posOrderId, dteId }, { status: 200 });

    const status = String(data.public_status || data.dte_status || body.type || body.event_type || "actualizada");
    const pdf = sharkposAbsoluteUrl(data.links?.pdf);

    await prisma.posOrder.update({
      where: { id: target.id },
      data: {
        boletaStatus: status,
        ...(data.folio != null ? { boletaFolio: Number(data.folio) } : {}),
        ...(dteId ? { boletaDteId: dteId } : {}),
        ...(pdf ? { boletaPdfUrl: pdf } : {}),
      },
    });

    return NextResponse.json({ ok: true, posOrderId: target.id, status }, { status: 200 });
  } catch (e) {
    // Fallo transitorio de BD → 5xx para que SharkPOS reintente (el update es idempotente).
    console.error("[sharkpos/webhook] processing_failed", String(e));
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}

// Verificación de dominio (algunos registradores hacen GET).
export async function GET() {
  return NextResponse.json({ ok: true, service: "sharkpos-webhook" });
}
