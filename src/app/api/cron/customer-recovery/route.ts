import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig, type RecoveryConfig } from "@/lib/ecommerce/store-config";
import { getClientSegmentation, resolveBrandIds, type ClientRow } from "@/lib/ecommerce/client-segmentation";
import { pickAutomation, indexEnrollments, type RecoveryAutomation } from "@/lib/ecommerce/recovery-eligibility";
import { readImportedClients, buildImportedChurnedClients } from "@/lib/ecommerce/recoveryImport";
import { branchDisplayName } from "@/lib/ecommerce/recoveryCoupon";
import { firstBuyerSubject, firstBuyerHtml, firstBuyerText } from "@/lib/email/recovery/firstBuyerEmail";
import { atRiskSubject, atRiskHtml, atRiskText } from "@/lib/email/recovery/atRiskEmail";
import { abandonmentSurveySubject, abandonmentSurveyHtml, abandonmentSurveyText } from "@/lib/email/recovery/abandonmentSurveyEmail";
import { recoveryIncentiveSubject, recoveryIncentiveHtml, recoveryIncentiveText } from "@/lib/email/recovery/recoveryIncentiveEmail";

export const runtime = "nodejs";
export const maxDuration = 300;

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
const MAX_TOTAL = 1000; // tope duro de envíos por corrida
// Cortar antes del límite de Vercel (maxDuration) para no dejar envíos a medias.
const TIME_BUDGET_MS = 270_000;

type Automation = RecoveryAutomation;

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
    // 1. Restaurantes con recovery habilitado.
    //    El opt-in real es recovery.enabled; NO dependemos de orderingEnabled (flag del
    //    pilar legacy "pedir online"): un local del pilar ecommerce —p. ej. Hand Roll con
    //    dominio propio— puede tener orderingEnabled=false y aun así usar recuperación.
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, logoUrl: true, slug: true, ecommerceStoreConfig: true },
    });

    const eligible = restaurants.filter(r => {
      const cfg = parseStoreConfig(r.ecommerceStoreConfig);
      return cfg.recovery.enabled;
    });
    const eligibleIds = new Set(eligible.map(r => r.id));

    // 2. Emails dados de baja (global)
    const unsubscribed = new Set<string>();
    const unsubs = await prisma.qRUser.findMany({
      where: { unsubscribedAt: { not: null } },
      select: { email: true },
    });
    for (const u of unsubs) if (u.email) unsubscribed.add(u.email.toLowerCase());

    // ── FASE 1: preparar la cola de cada local (segmentar + filtrar, SIN enviar) ──
    // El envío real se hace round-robin (fase 2) para repartir el cupo diario de forma
    // justa entre los locales; así ninguno (p. ej. Hand Roll con 14k) acapara el día.
    type Job = {
      restaurantId: string; storeName: string; branchName: string; logoUrl: string | null;
      accent: string; storeUrl: string; client: ClientRow; automation: Automation; rc: RecoveryConfig;
    };
    const queues: Job[][] = [];
    const queuedEmails = new Set<string>(); // un mismo email recibe un solo correo por corrida
    const since180 = new Date(Date.now() - 180 * 86400000);

    for (const rest of eligible) {
      if (Date.now() - startMs > TIME_BUDGET_MS) break;
      const cfg = parseStoreConfig(rest.ecommerceStoreConfig);
      const rc = cfg.recovery;
      const storeUrl = cfg.customDomain ? `https://${cfg.customDomain}` : `${BASE}/ecommerce/${rest.slug}`;

      try {
        // Segmentar clientes (+ importados manuales como perdidos sintéticos)
        const realClients = await getClientSegmentation(rest.id);
        const existingEmails = new Set(realClients.filter(c => c.email).map(c => c.email.toLowerCase()));
        const importedClients = buildImportedChurnedClients(readImportedClients(rest.ecommerceStoreConfig), existingEmails, rest.id);
        const clients = [...realClients, ...importedClients];
        if (!clients.length) continue;

        // Historial de envíos de TODA la marca (últimos 180 días): así no se repite
        // la encuesta desde otra sucursal y el cupón exige una encuesta realmente enviada.
        const brandIds = await resolveBrandIds(rest.id);
        const existing = await prisma.recoveryEnrollment.findMany({
          where: { restaurantId: { in: brandIds }, createdAt: { gte: since180 } },
          select: { customerEmail: true, automation: true, sentAt: true, status: true, createdAt: true },
        });
        const idx = indexEnrollments(existing);

        const jobs: Job[] = [];
        for (const client of clients) {
          if (!client.email) continue;
          // Cada cliente se contacta desde la sucursal de su ÚLTIMO pedido (el cupón solo
          // vale ahí). Si esa sucursal no tiene recuperación activa, lo toma esta.
          if (client.lastRestaurantId && client.lastRestaurantId !== rest.id && eligibleIds.has(client.lastRestaurantId)) continue;
          const email = client.email.toLowerCase();
          if (unsubscribed.has(email) || queuedEmails.has(email)) continue;

          // Cooldown: no enviar si recibió email en los últimos cooldownDays
          const lastEmail = idx.lastSent.get(email);
          if (lastEmail && (Date.now() - lastEmail) < rc.cooldownDays * 86400000) continue;

          // Frecuencia mensual: emails enviados en últimos 30 días
          if ((idx.sentLast30.get(email) ?? 0) >= rc.maxEmailsPerMonth) continue;

          // Qué automatización aplicar (prioridad: encuesta → cupón)
          const automation = pickAutomation(client, rc, email, idx);
          if (!automation) continue;

          queuedEmails.add(email);
          jobs.push({
            restaurantId: rest.id, storeName: rest.name, branchName: branchDisplayName(rest),
            logoUrl: cfg.storeLogoUrl ?? rest.logoUrl, accent: cfg.primaryColor, storeUrl, client, automation, rc,
          });
        }
        if (jobs.length) queues.push(jobs);
      } catch (e) {
        errors.push(`prep ${rest.id}: ${(e as Error).message}`);
      }
    }

    // ── FASE 2: enviar con cupo dividido (cupones + encuestas) ──
    // Cupo dividido: máx 400 cupones + máx 600 encuestas = 1000 total.
    // Así ninguno de los dos bloquea al otro. Cupones van primero dentro de su cupo.
    const MAX_COUPONS = 400;
    const MAX_SURVEYS = 600;
    // Separar jobs en 2 colas planas (round-robin ya mezclado por local)
    const couponJobs: typeof queues[0] = [];
    const surveyJobs: typeof queues[0] = [];
    const cursors = queues.map(() => 0);
    // Flatten round-robin: un job por local por vuelta
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (let i = 0; i < queues.length; i++) {
        if (cursors[i] < queues[i].length) {
          const job = queues[i][cursors[i]++];
          if (job.automation === "recovery_incentive") couponJobs.push(job);
          else surveyJobs.push(job);
          anyLeft = true;
        }
      }
    }
    // Enviar: primero cupones (hasta MAX_COUPONS), luego encuestas (hasta MAX_SURVEYS)
    const sendQueue = [...couponJobs.slice(0, MAX_COUPONS), ...surveyJobs.slice(0, MAX_SURVEYS)];
    let si = 0;
    while (si < sendQueue.length && totalSent < MAX_TOTAL && Date.now() - startMs <= TIME_BUDGET_MS) {
      const job = sendQueue[si++];
      try {
        const sent = await enrollAndSend({
          restaurantId: job.restaurantId, storeName: job.storeName, branchName: job.branchName,
          logoUrl: job.logoUrl, accent: job.accent, storeUrl: job.storeUrl, client: job.client, automation: job.automation, rc: job.rc,
        });
        if (sent) totalSent++; else totalSkipped++;
      } catch (e) {
        totalSkipped++;
        errors.push(`send ${job.restaurantId}: ${(e as Error).message}`);
      }
      // Rate limit: 300ms entre envíos (~3/seg, dentro del límite de Resend)
      await new Promise(r => setTimeout(r, 300));
    }

    // ── FASE 3: atribución de conversiones (post-envío, con margen bajo maxDuration) ──
    const ATTR_DEADLINE_MS = 285_000;
    for (const rest of eligible) {
      if (Date.now() - startMs > ATTR_DEADLINE_MS) break;
      try {
        totalConverted += await attributeConversions(rest.id);
      } catch (e) {
        errors.push(`attr ${rest.id}: ${(e as Error).message}`);
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

/** Inscribe al cliente y envía el email. Devuelve true si se envió. */
async function enrollAndSend(args: {
  restaurantId: string; storeName: string; branchName: string; logoUrl: string | null;
  accent: string; storeUrl: string; client: ClientRow; automation: Automation; rc: RecoveryConfig;
}): Promise<boolean> {
  const { restaurantId, storeName, branchName, logoUrl, accent, storeUrl, client, automation, rc } = args;

  // Verificación de seguridad: consulta directa a DB para evitar duplicados
  // (protege contra idx incompleto o race conditions entre crons)
  const alreadySent = await prisma.recoveryEnrollment.findFirst({
    where: {
      customerEmail: { equals: client.email, mode: "insensitive" },
      automation,
      sentAt: { not: null },
    },
    select: { id: true },
  });
  if (alreadySent) return false; // ya se envió, no duplicar

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
        // % prometido en el email: el cupón se cobra SIEMPRE con este valor,
        // aunque después se cambie la configuración del local.
        ...(automation === "recovery_incentive" ? { couponPercent: rc.recoveryIncentive.couponPercent } : {}),
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
          where: { restaurantId: { in: await resolveBrandIds(restaurantId) }, customerEmail: { equals: client.email, mode: "insensitive" }, automation: "abandonment_survey", surveyReason: { not: null } },
          select: { surveyReason: true },
          orderBy: { createdAt: "desc" },
        });
        surveyReason = prevEnrollment?.surveyReason || null;
      } catch { /* noop */ }
      subject = recoveryIncentiveSubject({ customerName: client.name, storeName, couponPercent: rc.recoveryIncentive.couponPercent });
      html = recoveryIncentiveHtml({ ...commonArgs, surveyReason, couponCode: couponCode!, couponPercent: rc.recoveryIncentive.couponPercent, branchName });
      text = recoveryIncentiveText({ ...commonArgs, couponCode: couponCode!, couponPercent: rc.recoveryIncentive.couponPercent, branchName });
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

  // El cliente puede volver (y usar el cupón) en cualquier sucursal de la marca.
  const brandIds = await resolveBrandIds(restaurantId);
  let converted = 0;
  for (const e of pending) {
    if (!e.sentAt) continue;
    const email = e.customerEmail.toLowerCase();

    // Buscar pedido posterior al envío
    const order = await prisma.posOrder.findFirst({
      where: {
        restaurantId: { in: brandIds },
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
