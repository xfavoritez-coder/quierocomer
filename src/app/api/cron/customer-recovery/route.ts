import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig, type RecoveryConfig } from "@/lib/ecommerce/store-config";
import { getClientSegmentation, type ClientRow } from "@/lib/ecommerce/client-segmentation";
import { storeAbsBase } from "@/lib/ecommerce/surveyEmail";
import { firstBuyerSubject, firstBuyerHtml, firstBuyerText } from "@/lib/email/recovery/firstBuyerEmail";
import { atRiskSubject, atRiskHtml, atRiskText } from "@/lib/email/recovery/atRiskEmail";
import { abandonmentSurveySubject, abandonmentSurveyHtml, abandonmentSurveyText } from "@/lib/email/recovery/abandonmentSurveyEmail";
import { recoveryIncentiveSubject, recoveryIncentiveHtml, recoveryIncentiveText } from "@/lib/email/recovery/recoveryIncentiveEmail";

export const runtime = "nodejs";
export const maxDuration = 120;

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
const MAX_PER_RESTAURANT = 50;
const MAX_TOTAL = 200;

type Automation = "first_buyer" | "at_risk" | "abandonment_survey" | "recovery_incentive";

/** Cron diario: segmenta clientes → inscribe en automatizaciones → envía emails → atribuye conversiones. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  let totalSent = 0;
  let totalSkipped = 0;
  let totalConverted = 0;
  const errors: string[] = [];

  try {
    // 1. Restaurantes con recovery habilitado
    const restaurants = await prisma.restaurant.findMany({
      where: { orderingEnabled: true },
      select: { id: true, name: true, logoUrl: true, slug: true, ecommerceStoreConfig: true },
    });

    const eligible = restaurants.filter(r => {
      const cfg = parseStoreConfig(r.ecommerceStoreConfig);
      return cfg.recovery.enabled;
    });

    // 2. Emails dados de baja (global)
    const unsubscribed = new Set<string>();
    const unsubs = await prisma.qRUser.findMany({
      where: { unsubscribedAt: { not: null } },
      select: { email: true },
    });
    for (const u of unsubs) if (u.email) unsubscribed.add(u.email.toLowerCase());

    for (const rest of eligible) {
      if (totalSent >= MAX_TOTAL) break;
      const cfg = parseStoreConfig(rest.ecommerceStoreConfig);
      const rc = cfg.recovery;
      const storeUrl = cfg.customDomain ? `https://${cfg.customDomain}` : `${BASE}/ecommerce/${rest.slug}`;

      try {
        // 2. Segmentar clientes
        const clients = await getClientSegmentation(rest.id);
        if (!clients.length) continue;

        // 3. Cargar enrollments existentes para este restaurante (últimos 180 días)
        const since180 = new Date(Date.now() - 180 * 86400000);
        const existing = await prisma.recoveryEnrollment.findMany({
          where: { restaurantId: rest.id, createdAt: { gte: since180 } },
          select: { customerEmail: true, automation: true, sentAt: true, status: true },
        });

        // Mapa de último envío por email+automation
        const lastSent = new Map<string, Date>();
        const hasEnrollment = new Set<string>();
        for (const e of existing) {
          const key = `${e.customerEmail.toLowerCase()}::${e.automation}`;
          hasEnrollment.add(key);
          if (e.sentAt && (!lastSent.has(e.customerEmail.toLowerCase()) || e.sentAt > lastSent.get(e.customerEmail.toLowerCase())!)) {
            lastSent.set(e.customerEmail.toLowerCase(), e.sentAt);
          }
        }

        // Enrollments con abandonment_survey completados
        const hasAbandonment = new Set<string>();
        for (const e of existing) {
          if (e.automation === "abandonment_survey") hasAbandonment.add(e.customerEmail.toLowerCase());
        }

        let sentThisRestaurant = 0;

        for (const client of clients) {
          if (sentThisRestaurant >= MAX_PER_RESTAURANT || totalSent >= MAX_TOTAL) break;
          if (!client.email) continue;
          const email = client.email.toLowerCase();
          if (unsubscribed.has(email)) continue;

          // Cooldown: no enviar si recibió email en los últimos cooldownDays
          const lastEmail = lastSent.get(email);
          if (lastEmail && (Date.now() - lastEmail.getTime()) < rc.cooldownDays * 86400000) continue;

          // Frecuencia mensual: contar emails enviados en últimos 30 días
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
          const recentCount = existing.filter(e => e.customerEmail.toLowerCase() === email && e.sentAt && e.sentAt > thirtyDaysAgo).length;
          if (recentCount >= rc.maxEmailsPerMonth) continue;

          // Determinar qué automatización aplicar (prioridad)
          const automation = pickAutomation(client, rc, email, hasEnrollment, hasAbandonment);
          if (!automation) continue;

          // Crear enrollment y enviar
          const sent = await enrollAndSend({
            restaurantId: rest.id, storeName: rest.name, logoUrl: cfg.storeLogoUrl ?? rest.logoUrl,
            accent: cfg.primaryColor, storeUrl, client, automation, rc,
          });

          if (sent) {
            sentThisRestaurant++;
            totalSent++;
            lastSent.set(email, new Date());
            hasEnrollment.add(`${email}::${automation}`);
          } else {
            totalSkipped++;
          }
        }

        // 7. Atribución: marcar conversiones
        const converted = await attributeConversions(rest.id);
        totalConverted += converted;

      } catch (e) {
        errors.push(`${rest.id}: ${(e as Error).message}`);
      }
    }

    // Log
    await prisma.cronLog.create({
      data: {
        jobName: "customer-recovery",
        status: errors.length ? "partial" : "success",
        durationMs: Date.now() - startMs,
        details: { eligible: eligible.length, sent: totalSent, skipped: totalSkipped, converted: totalConverted } as object,
        error: errors.length ? errors.join("; ").slice(0, 500) : undefined,
      },
    });

  } catch (e) {
    await prisma.cronLog.create({
      data: { jobName: "customer-recovery", status: "error", durationMs: Date.now() - startMs, error: (e as Error).message?.slice(0, 500) },
    }).catch(() => {});
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: totalSent, skipped: totalSkipped, converted: totalConverted, errors: errors.length });
}

/** Decide qué automatización aplicar a un cliente (o null si ninguna).
 *  Respeta la frecuencia natural del cliente: si pide cada 30 días y lleva 45,
 *  no es anormal todavía. Solo contactar si lleva al menos 2x su frecuencia
 *  habitual O si no tiene frecuencia conocida y supera el umbral de config. */
function pickAutomation(
  client: ClientRow,
  rc: RecoveryConfig,
  email: string,
  hasEnrollment: Set<string>,
  hasAbandonment: Set<string>,
): Automation | null {
  // Contactar si: lleva > 90 días (tope absoluto) O supera 2.5x su frecuencia.
  // Mínimo siempre el umbral de config (45 días por defecto).
  const freq = client.avgFrequencyDays;
  const minDaysForContact = Math.min(
    90, // tope: nunca esperar más de 90 días
    freq ? Math.max(rc.abandonmentSurvey.daysInactive, Math.round(freq * 2.5)) : rc.abandonmentSurvey.daysInactive
  );

  // Encuesta de abandono
  if (rc.abandonmentSurvey.enabled && client.status === "churned" && client.daysSinceLastOrder >= minDaysForContact && client.orders >= 2) {
    if (!hasEnrollment.has(`${email}::abandonment_survey`)) return "abandonment_survey";
  }
  // Incentivo de recuperación
  const minDaysIncentive = Math.min(120, freq
    ? Math.max(rc.recoveryIncentive.daysInactive, Math.round(freq * 3))
    : rc.recoveryIncentive.daysInactive);
  if (rc.recoveryIncentive.enabled && client.status === "churned" && client.daysSinceLastOrder >= minDaysIncentive && client.orders >= 2) {
    if (hasAbandonment.has(email) && !hasEnrollment.has(`${email}::recovery_incentive`)) return "recovery_incentive";
  }
  return null;
}

/** Inscribe al cliente y envía el email. Devuelve true si se envió. */
async function enrollAndSend(args: {
  restaurantId: string; storeName: string; logoUrl: string | null;
  accent: string; storeUrl: string; client: ClientRow; automation: Automation; rc: RecoveryConfig;
}): Promise<boolean> {
  const { restaurantId, storeName, logoUrl, accent, storeUrl, client, automation, rc } = args;

  // Generar cupón si es incentivo
  let couponCode: string | null = null;
  if (automation === "recovery_incentive") {
    couponCode = `VUELVE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  // Crear enrollment
  const enrollment = await prisma.recoveryEnrollment.create({
    data: {
      restaurantId,
      customerEmail: client.email,
      customerPhone: client.phone || null,
      customerName: client.name || null,
      automation,
      status: "pending",
      couponCode,
      contextJson: {
        daysSince: client.daysSinceLastOrder,
        avgFreq: client.avgFrequencyDays,
        totalSpent: client.totalSpent,
        orders: client.orders,
        riskScore: client.riskScore,
        topProduct: client.topProduct,
      },
    },
  });

  // Los cupones VUELVE-* se validan directamente desde RecoveryEnrollment
  // (no se crean en el JSON de ecommerceCoupons del panel para no llenarlo).

  // Preparar email
  const unsubscribeUrl = `${BASE}/api/email/unsubscribe?email=${encodeURIComponent(client.email)}`;
  let subject: string, html: string, text: string;

  const commonArgs = { storeName, logoUrl, accent, customerName: client.name, topProduct: client.topProduct, storeUrl, unsubscribeUrl };

  switch (automation) {
    case "first_buyer":
      subject = firstBuyerSubject({ customerName: client.name, storeName });
      html = firstBuyerHtml(commonArgs);
      text = firstBuyerText(commonArgs);
      break;
    case "at_risk":
      subject = atRiskSubject({ customerName: client.name, storeName });
      html = atRiskHtml(commonArgs);
      text = atRiskText(commonArgs);
      break;
    case "abandonment_survey":
      const surveyUrl = `${BASE}/encuesta-abandono/${enrollment.id}`;
      subject = abandonmentSurveySubject({ customerName: client.name, storeName });
      html = abandonmentSurveyHtml({ ...commonArgs, surveyUrl });
      text = abandonmentSurveyText({ ...commonArgs, surveyUrl });
      break;
    case "recovery_incentive":
      // Buscar la razón que dio en la encuesta de abandono para personalizar el mensaje
      let surveyReason: string | null = null;
      try {
        const prevEnrollment = await prisma.recoveryEnrollment.findFirst({
          where: { restaurantId, customerEmail: client.email.toLowerCase(), automation: "abandonment_survey", surveyReason: { not: null } },
          select: { surveyReason: true },
          orderBy: { createdAt: "desc" },
        });
        surveyReason = prevEnrollment?.surveyReason || null;
      } catch { /* noop */ }
      subject = recoveryIncentiveSubject({ customerName: client.name, storeName, couponPercent: rc.recoveryIncentive.couponPercent });
      html = recoveryIncentiveHtml({ ...commonArgs, surveyReason, couponCode: couponCode!, couponPercent: rc.recoveryIncentive.couponPercent });
      text = recoveryIncentiveText({ ...commonArgs, couponCode: couponCode!, couponPercent: rc.recoveryIncentive.couponPercent });
      break;
  }

  // Enviar via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`[recovery dev] ${automation} → ${client.email} | ${subject}`);
    await prisma.recoveryEnrollment.update({ where: { id: enrollment.id }, data: { status: "sent", sentAt: new Date() } });
    return true;
  }

  try {
    // Crear EmailLog para tracking
    const emailLog = await prisma.emailLog.create({
      data: { to: client.email, subject, purpose: `recovery_${automation}`, status: "sent" },
    });

    // Inyectar pixel de tracking
    const trackOpenUrl = `${BASE}/api/email/track/open?eid=${emailLog.id}`;
    html = html.replace("</body>", `<img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="" /></body>`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: `${storeName} <hola@quierocomer.cl>`,
        to: client.email,
        subject, html, text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[recovery] Resend error for ${client.email}:`, err);
      await prisma.emailLog.update({ where: { id: emailLog.id }, data: { status: "failed", errorMsg: JSON.stringify(err).slice(0, 500) } });
      await prisma.recoveryEnrollment.update({ where: { id: enrollment.id }, data: { status: "failed" } });
      return false;
    }

    await prisma.recoveryEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "sent", sentAt: new Date(), emailLogId: emailLog.id },
    });
    return true;

  } catch (e) {
    console.error(`[recovery] send error:`, e);
    await prisma.recoveryEnrollment.update({ where: { id: enrollment.id }, data: { status: "failed" } });
    return false;
  }
}

/** Revisa enrollments recientes y marca conversiones (pedido nuevo post-envío). */
async function attributeConversions(restaurantId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const pending = await prisma.recoveryEnrollment.findMany({
    where: {
      restaurantId,
      status: { in: ["sent", "delivered", "opened", "clicked"] },
      sentAt: { gte: thirtyDaysAgo },
      convertedAt: null,
    },
    select: { id: true, customerEmail: true, sentAt: true },
  });

  if (!pending.length) return 0;

  let converted = 0;
  for (const e of pending) {
    if (!e.sentAt) continue;
    const email = e.customerEmail.toLowerCase();

    // Buscar pedido posterior al envío
    const order = await prisma.posOrder.findFirst({
      where: {
        restaurantId,
        posStatus: { not: "canceled" },
        customerEmail: { equals: email, mode: "insensitive" },
        createdAt: { gt: e.sentAt },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (order) {
      await prisma.recoveryEnrollment.update({
        where: { id: e.id },
        data: { status: "converted", convertedAt: order.createdAt, convertedOrderId: order.id },
      });
      converted++;
    }
  }

  // También sync open/click desde EmailLog
  const withEmailLog = await prisma.recoveryEnrollment.findMany({
    where: { restaurantId, emailLogId: { not: null }, status: { in: ["sent", "delivered"] } },
    select: { id: true, emailLogId: true },
  });
  for (const e of withEmailLog) {
    if (!e.emailLogId) continue;
    const log = await prisma.emailLog.findUnique({ where: { id: e.emailLogId }, select: { openedAt: true, clickedAt: true } });
    if (log?.openedAt || log?.clickedAt) {
      await prisma.recoveryEnrollment.update({
        where: { id: e.id },
        data: {
          ...(log.openedAt ? { openedAt: log.openedAt, status: "opened" } : {}),
          ...(log.clickedAt ? { clickedAt: log.clickedAt, status: "clicked" } : {}),
        },
      });
    }
  }

  return converted;
}
