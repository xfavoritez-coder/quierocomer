import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { sendSurveyEmail, storeAbsBase } from "@/lib/ecommerce/surveyEmail";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron: envía las encuestas de satisfacción pendientes.
 * Un pedido califica si: estado DONE (Entregado), tiene correo, aún no se envió
 * (surveySentAt null), la tienda tiene la encuesta activada y ya pasaron las horas
 * configuradas desde que quedó DONE.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const since = new Date(now - 7 * 24 * 60 * 60 * 1000); // ventana de 7 días para acotar

  const candidates = await prisma.onlineOrder.findMany({
    where: { status: "DONE", surveySentAt: null, customerEmail: { not: null }, updatedAt: { gte: since } },
    orderBy: { updatedAt: "asc" },
    take: 120,
    select: {
      id: true, customerName: true, customerEmail: true, statusHistory: true, updatedAt: true, restaurantId: true,
      restaurant: { select: { name: true, logoUrl: true, cartaAccentColor: true, ecommerceStoreConfig: true } },
    },
  });

  let sent = 0, skipped = 0;
  for (const o of candidates) {
    const cfg = parseStoreConfig(o.restaurant.ecommerceStoreConfig, { accent: o.restaurant.cartaAccentColor });
    const s = cfg.survey;
    if (!s.enabled || s.questions.filter((q) => q.active).length === 0) { skipped++; continue; }

    // Momento en que quedó DONE (desde statusHistory; fallback updatedAt).
    let doneTs = o.updatedAt.getTime();
    try {
      const hist = Array.isArray(o.statusHistory) ? (o.statusHistory as { status?: string; ts?: string }[]) : [];
      const done = hist.filter((h) => h?.status === "DONE" && h?.ts).map((h) => new Date(h.ts as string).getTime()).filter((t) => Number.isFinite(t));
      if (done.length) doneTs = Math.max(...done);
    } catch {}

    if (now - doneTs < s.hoursAfter * 60 * 60 * 1000) { skipped++; continue; } // aún no toca

    const link = `${storeAbsBase({ customDomain: cfg.customDomain })}/encuesta/${o.id}`;
    const ok = await sendSurveyEmail({
      to: o.customerEmail as string, link, storeName: o.restaurant.name, logoUrl: o.restaurant.logoUrl,
      accent: cfg.primaryColor, customerName: o.customerName, survey: s,
    });
    if (ok) {
      await prisma.onlineOrder.update({ where: { id: o.id }, data: { surveySentAt: new Date() } }).catch(() => {});
      sent++;
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, sent, skipped });
}
