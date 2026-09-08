import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertOwnership } from "@/lib/ecommerce/panelAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { sendSurveyEmail, storeAbsBase } from "@/lib/ecommerce/surveyEmail";

export const runtime = "nodejs";

/**
 * POST /api/panel/ecommerce/survey/test
 * Envía un correo de encuesta de PRUEBA a un email. El enlace abre la encuesta en
 * modo vista previa (no guarda respuesta ni requiere un pedido real).
 * body: { restaurantId, email }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, logoUrl: true, cartaAccentColor: true, ecommerceStoreConfig: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const cfg = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor });

  const link = `${storeAbsBase({ customDomain: cfg.customDomain })}/encuesta/preview_${restaurantId}`;
  const ok = await sendSurveyEmail({
    to: email, link, storeName: r.name, logoUrl: r.logoUrl, accent: cfg.primaryColor,
    customerName: null, survey: cfg.survey,
  });
  if (!ok) return NextResponse.json({ error: "No se pudo enviar el correo de prueba" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
