import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { sendSurveyEmail, storeAbsBase } from "@/lib/ecommerce/surveyEmail";
import { chileDayRangeUtc, chileTodayYmd } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/ecommerce-surveys/send-today
 * body: { restaurantIds: string[] }
 * Envía encuestas a todos los pedidos DONE de hoy para los locales indicados,
 * sin importar survey.enabled ni la ventana de horas. Útil para recuperar
 * un día en que la encuesta estaba desactivada.
 */
export async function POST(req: NextRequest) {
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const restaurantIds: string[] = Array.isArray(body?.restaurantIds) ? body.restaurantIds : [];
  if (restaurantIds.length === 0) return NextResponse.json({ error: "Falta restaurantIds" }, { status: 400 });

  const today = chileTodayYmd();
  const { start } = chileDayRangeUtc(today);
  const { end } = chileDayRangeUtc(today);

  const candidates = await prisma.onlineOrder.findMany({
    where: {
      restaurantId: { in: restaurantIds },
      status: "DONE",
      paymentStatus: { in: ["paid", "unpaid"] },
      surveySentAt: null,
      customerEmail: { not: null },
      updatedAt: { gte: start, lte: end },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true, customerName: true, customerEmail: true,
      restaurant: { select: { name: true, logoUrl: true, cartaAccentColor: true, ecommerceStoreConfig: true } },
    },
  });

  let sent = 0, skipped = 0;
  const emailProcessedThisRun = new Set<string>();

  for (const o of candidates) {
    const email = (o.customerEmail as string).toLowerCase().trim();
    if (emailProcessedThisRun.has(email)) { skipped++; continue; }

    const cfg = parseStoreConfig(o.restaurant.ecommerceStoreConfig, { accent: o.restaurant.cartaAccentColor });
    // Omitir si no hay preguntas activas (aunque enabled=false lo ignoramos)
    if (cfg.survey.questions.filter((q) => q.active).length === 0) { skipped++; continue; }

    const claimed = await prisma.onlineOrder.updateMany({
      where: { id: o.id, surveySentAt: null },
      data: { surveySentAt: new Date() },
    });
    if (claimed.count === 0) { skipped++; continue; }

    const link = `${storeAbsBase({ customDomain: cfg.customDomain })}/encuesta/${o.id}`;
    const ok = await sendSurveyEmail({
      to: o.customerEmail as string, link, storeName: o.restaurant.name,
      logoUrl: cfg.storeLogoUrl ?? o.restaurant.logoUrl, accent: cfg.primaryColor,
      customerName: o.customerName, survey: cfg.survey,
    });
    if (ok) { sent++; emailProcessedThisRun.add(email); } else skipped++;
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, sent, skipped });
}
