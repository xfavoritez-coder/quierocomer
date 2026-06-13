/**
 * Envío masivo de email de reactivación.
 * - Crea EmailLog con open/click tracking
 * - Envuelve links con click tracker
 * - Registra evento en lead.events
 * - Excluye duplicados y emails inválidos
 *
 * Uso: npx tsx scripts/send-reactivation-campaign.ts [--dry-run]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { reactivationEmailHtml } from "../src/lib/email/reactivationEmailHtml";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL
  ? `QuieroComer <${process.env.FROM_EMAIL}>`
  : "QuieroComer <onboarding@resend.dev>";
const BASE_URL = "https://quierocomer.cl";
const DRY_RUN = process.argv.includes("--dry-run");

const p = new PrismaClient();

// Excluded: power users that don't need this email
const EXCLUDED_SLUGS = new Set([
  "el-menu-de-la-esquina", // 1935 eventos
  "forty-four",            // 91 eventos, 133 acciones panel
  "pakary",                // 88 eventos
]);

function trackUrl(eid: string, url: string) {
  return `${BASE_URL}/api/email/track/click?eid=${eid}&url=${encodeURIComponent(url)}`;
}

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN — no se enviarán emails\n" : "📧 ENVIANDO EMAILS\n");

  // ── 1. Get all leads (activated + not activated) ──
  const allLeads = await p.lead.findMany({
    where: { cartaStatus: { in: ["READY", "DELIVERED"] } },
    select: {
      id: true, email: true, ownerName: true, localName: true,
      generatedSlug: true, activatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // ── 2. Get activated leads with high usage (to exclude) ──
  const activatedSlugs = allLeads
    .filter(l => l.activatedAt && l.generatedSlug)
    .map(l => l.generatedSlug!);

  const highUsageRestaurants = new Set<string>();
  for (const slug of activatedSlugs) {
    if (EXCLUDED_SLUGS.has(slug)) {
      highUsageRestaurants.add(slug);
      continue;
    }
  }

  // ── 3. Deduplicate by email, exclude invalid ──
  const seenEmails = new Set<string>();
  const targets: typeof allLeads = [];

  for (const lead of allLeads) {
    const email = lead.email.toLowerCase();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);

    // Skip invalid emails
    if (email.endsWith(".con") || !email.includes("@")) continue;

    // Skip excluded high-usage
    if (lead.generatedSlug && EXCLUDED_SLUGS.has(lead.generatedSlug)) continue;

    // Must have a restaurant with dishes
    if (!lead.generatedSlug) continue;

    targets.push(lead);
  }

  console.log(`Total leads con carta: ${allLeads.length}`);
  console.log(`Excluidos (power users): ${EXCLUDED_SLUGS.size}`);
  console.log(`Targets después de dedup + filtros: ${targets.length}\n`);

  // ── 4. Send emails ──
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of targets) {
    const slug = lead.generatedSlug!;
    const restaurant = await p.restaurant.findFirst({
      where: { slug },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: {
            dishes: {
              where: { isActive: true },
              orderBy: { position: "asc" },
              take: 1,
              select: { name: true, photos: true, price: true },
            },
          },
        },
      },
    });

    if (!restaurant) { skipped++; continue; }

    // Get real dish counts
    const dishCounts = await p.dish.groupBy({
      by: ["categoryId"],
      where: { restaurantId: restaurant.id, isActive: true },
      _count: true,
    });
    const countMap = new Map(dishCounts.map(c => [c.categoryId, c._count]));

    const categories = restaurant.categories.map(c => ({
      name: c.name,
      dishCount: countMap.get(c.id) || 0,
      topDish: c.dishes[0]?.name || undefined,
      topDishPhoto: c.dishes[0]?.photos?.[0] || null,
      topDishPrice: c.dishes[0]?.price || null,
    })).filter(c => c.dishCount > 0);

    const totalDishes = categories.reduce((sum, c) => sum + c.dishCount, 0);
    if (totalDishes === 0) { skipped++; continue; }

    const firstName = lead.ownerName.split(" ")[0];
    const subject = `${firstName}, tu carta QR es gratis y está lista`;

    // Create EmailLog FIRST (for tracking)
    const emailLog = await p.emailLog.create({
      data: { to: lead.email, subject, purpose: "reactivation", status: "sent" },
    }).catch(() => null);

    const eid = emailLog?.id || "unknown";

    // Build tracked URLs
    const cartaUrl = trackUrl(eid, `${BASE_URL}/qr/${slug}`);
    const panelUrl = trackUrl(eid, `${BASE_URL}/panel`);
    const activarUrl = trackUrl(eid, `${BASE_URL}/activar/${slug}`);
    const openPixel = `${BASE_URL}/api/email/track/open?eid=${eid}`;

    const html = reactivationEmailHtml({
      ownerName: firstName,
      restaurantName: restaurant.name,
      logoUrl: restaurant.logoUrl,
      slug,
      dishCount: totalDishes,
      categories,
      cartaUrl,
      panelUrl,
      activarUrl,
      openPixel,
    });

    if (DRY_RUN) {
      console.log(`  ✉ [DRY] ${lead.localName.padEnd(30)} → ${lead.email} (${totalDishes} platos, ${categories.length} cats)`);
      sent++;
      continue;
    }

    try {
      const { error } = await resend.emails.send({
        from: FROM, to: lead.email, subject, html,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });

      if (error) {
        console.error(`  ❌ ${lead.localName}: ${error.message}`);
        if (eid !== "unknown") p.emailLog.update({ where: { id: eid }, data: { status: "failed", errorMsg: error.message } }).catch(() => {});
        failed++;
        continue;
      }

      // Log event on lead
      await p.lead.update({
        where: { id: lead.id },
        data: {
          events: {
            push: { ts: new Date().toISOString(), action: "reactivation_email_sent", emailLogId: eid },
          },
        },
      }).catch(() => {});

      // Track cost
      import("../src/lib/costTracker").then(m => m.logResendUsage({ to: lead.email, purpose: "reactivation" })).catch(() => {});

      console.log(`  ✅ ${lead.localName.padEnd(30)} → ${lead.email}`);
      sent++;

      // Rate limit: 2 per second to be safe with Resend
      await new Promise(r => setTimeout(r, 500));

    } catch (err: any) {
      console.error(`  ❌ ${lead.localName}: ${err.message}`);
      if (eid !== "unknown") p.emailLog.update({ where: { id: eid }, data: { status: "failed", errorMsg: err.message } }).catch(() => {});
      failed++;
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Enviados: ${sent}`);
  console.log(`  Fallidos: ${failed}`);
  console.log(`  Saltados: ${skipped}`);
  console.log(`${"═".repeat(50)}`);

  await p.$disconnect();
}

main().catch(console.error);
