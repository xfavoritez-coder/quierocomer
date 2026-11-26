/**
 * Simula la fase 1+2 del cron de recuperación SIN enviar emails.
 * Muestra exactamente qué se enviaría: cuántos cupones, cuántos encuestas,
 * cuántos por local, y quiénes van primero en cupones (respondidos vs no).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Replicar imports del cron
import { parseStoreConfig, type RecoveryConfig } from "@/lib/ecommerce/store-config";
import { getClientSegmentation, resolveBrandIds, type ClientRow } from "@/lib/ecommerce/client-segmentation";
import { pickAutomation, indexEnrollments } from "@/lib/ecommerce/recovery-eligibility";
import { readImportedClients, buildImportedChurnedClients } from "@/lib/ecommerce/recoveryImport";
import { branchDisplayName } from "@/lib/ecommerce/recoveryCoupon";

const MAX_TOTAL = 1000;
const MAX_COUPONS = 500;

type Automation = "first_buyer" | "at_risk" | "abandonment_survey" | "recovery_incentive";

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true, slug: true, logoUrl: true, ecommerceStoreConfig: true },
  });
  const eligible = restaurants.filter(r => parseStoreConfig(r.ecommerceStoreConfig).recovery.enabled);
  const eligibleIds = new Set(eligible.map(r => r.id));
  console.log(`Locales con recuperación: ${eligible.map(r => r.name).join(", ")}\n`);

  // Unsubscribed
  const unsubs = await prisma.qRUser.findMany({ where: { unsubscribedAt: { not: null } }, select: { email: true } });
  const unsubscribed = new Set(unsubs.map(u => u.email!.toLowerCase()).filter(Boolean));

  type Job = { restaurantId: string; storeName: string; client: ClientRow; automation: Automation };
  const queues: Job[][] = [];
  const queuedEmails = new Set<string>();
  const since180 = new Date(Date.now() - 180 * 86400000);

  for (const rest of eligible) {
    const cfg = parseStoreConfig(rest.ecommerceStoreConfig);
    const rc = cfg.recovery;

    const realClients = await getClientSegmentation(rest.id);
    const existingEmails = new Set(realClients.filter(c => c.email).map(c => c.email.toLowerCase()));
    const importedClients = buildImportedChurnedClients(readImportedClients(rest.ecommerceStoreConfig), existingEmails, rest.id);
    const clients = [...realClients, ...importedClients];

    const brandIds = await resolveBrandIds(rest.id);
    const existing = await prisma.recoveryEnrollment.findMany({
      where: { restaurantId: { in: brandIds }, createdAt: { gte: since180 } },
      select: { customerEmail: true, automation: true, sentAt: true, status: true, createdAt: true, surveyReason: true },
    });
    const idx = indexEnrollments(existing);

    const jobs: Job[] = [];
    for (const client of clients) {
      if (!client.email) continue;
      if (client.lastRestaurantId && client.lastRestaurantId !== rest.id && eligibleIds.has(client.lastRestaurantId)) continue;
      const email = client.email.toLowerCase();
      if (unsubscribed.has(email) || queuedEmails.has(email)) continue;
      const automation = pickAutomation(client, rc, email, idx);
      if (!automation) continue;
      // Cooldown y límite mensual NO aplican a cupones (es continuación de la encuesta)
      if (automation !== "recovery_incentive") {
        const lastEmail = idx.lastSent.get(email);
        if (lastEmail && (Date.now() - lastEmail) < rc.cooldownDays * 86400000) continue;
        if ((idx.sentLast30.get(email) ?? 0) >= rc.maxEmailsPerMonth) continue;
      }
      queuedEmails.add(email);
      jobs.push({ restaurantId: rest.id, storeName: rest.name, client, automation });
    }
    if (jobs.length) queues.push(jobs);
    console.log(`${rest.name}: ${jobs.length} jobs (${jobs.filter(j => j.automation === "recovery_incentive").length} cupones, ${jobs.filter(j => j.automation === "abandonment_survey").length} encuestas)`);
  }

  // Indexar respondidos
  const respondedEmails = new Set<string>();
  for (const rest of eligible) {
    const brandIds = await resolveBrandIds(rest.id);
    const answered = await prisma.recoveryEnrollment.findMany({
      where: { restaurantId: { in: brandIds }, automation: "abandonment_survey", surveyReason: { not: null } },
      select: { customerEmail: true },
    });
    for (const a of answered) respondedEmails.add(a.customerEmail.toLowerCase());
  }
  console.log(`\nClientes que respondieron encuesta: ${respondedEmails.size}`);

  // Separar round-robin
  const couponJobs: Job[] = [];
  const surveyJobs: Job[] = [];
  const cursors = queues.map(() => 0);
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

  // Priorizar respondidos en cupones
  couponJobs.sort((a, b) => {
    const aR = respondedEmails.has(a.client.email.toLowerCase()) ? 0 : 1;
    const bR = respondedEmails.has(b.client.email.toLowerCase()) ? 0 : 1;
    return aR - bR;
  });

  const couponsToSend = couponJobs.slice(0, MAX_COUPONS);
  const surveysToSend = surveyJobs.slice(0, MAX_TOTAL - couponsToSend.length);
  const sendQueue = [...couponsToSend, ...surveysToSend];

  // Stats
  const couponRespondidos = couponsToSend.filter(j => respondedEmails.has(j.client.email.toLowerCase())).length;
  const couponNoRespondidos = couponsToSend.length - couponRespondidos;

  console.log(`\n${"═".repeat(50)}`);
  console.log(`SIMULACIÓN DEL CRON DE HOY`);
  console.log(`${"═".repeat(50)}`);
  console.log(`Total a enviar: ${sendQueue.length}`);
  console.log(`  Cupones: ${couponsToSend.length} (de ${couponJobs.length} elegibles)`);
  console.log(`    - Respondieron encuesta (prioridad): ${couponRespondidos}`);
  console.log(`    - No respondieron: ${couponNoRespondidos}`);
  console.log(`  Encuestas: ${surveysToSend.length} (de ${surveyJobs.length} elegibles)`);

  // Por local
  console.log(`\nPor local:`);
  const byLocal = new Map<string, { coupons: number; surveys: number }>();
  for (const j of sendQueue) {
    const key = j.storeName;
    const e = byLocal.get(key) ?? { coupons: 0, surveys: 0 };
    if (j.automation === "recovery_incentive") e.coupons++; else e.surveys++;
    byLocal.set(key, e);
  }
  for (const [name, stats] of byLocal) {
    console.log(`  ${name}: ${stats.coupons} cupones + ${stats.surveys} encuestas = ${stats.coupons + stats.surveys}`);
  }

  // Muestra primeros 5 cupones
  console.log(`\nPrimeros 5 cupones que se enviarían:`);
  for (const j of couponsToSend.slice(0, 5)) {
    const responded = respondedEmails.has(j.client.email.toLowerCase());
    console.log(`  ${j.client.email} (${j.storeName}) ${responded ? "✅ respondió" : "⬜ no respondió"}`);
  }

  console.log(`\nQuedan pendientes para mañana:`);
  console.log(`  Cupones: ${Math.max(0, couponJobs.length - MAX_COUPONS)}`);
  console.log(`  Encuestas: ${Math.max(0, surveyJobs.length - surveysToSend.length)}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
