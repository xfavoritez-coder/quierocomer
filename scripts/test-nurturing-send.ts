import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const prisma = new PrismaClient();

const BLACKLIST = new Set(["+56976485972", "+56977940643"]);

async function main() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const wasSent = (events: any, key: string) => Array.isArray(events) && events.some((e: any) => e.action === key);
  const bl = (wa: string | null) => !wa || BLACKLIST.has(wa);

  // Scenario 1: No revisó (no click)
  const s1 = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      activatedAt: null,
      panelVisitedAt: null,
      emailClickedAt: null,
      whatsappClickedAt: null,
      whatsapp: { not: null },
      generatedSlug: { not: null },
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
  });

  // Scenario 1b: Vio carta pero no activó
  const s1b = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      activatedAt: null,
      whatsapp: { not: null },
      generatedSlug: { not: null },
      OR: [
        { emailClickedAt: { not: null } },
        { whatsappClickedAt: { not: null } },
      ],
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
  });

  // Scenario 2: Activó pero no volvió
  const s2 = await prisma.lead.findMany({
    where: {
      activatedAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      whatsapp: { not: null },
      generatedSlug: { not: null },
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
  });

  // Filter: only those NOT already sent and NOT in blacklist, and NOT in tomorrow's pending list
  const pendingS1 = s1.filter(l => !wasSent(l.events, "nurturing_no_revisada") && !bl(l.whatsapp));
  const pendingS1b = s1b.filter(l => !wasSent(l.events, "nurturing_vio_no_activo") && !bl(l.whatsapp));
  const pendingS2 = s2.filter(l => !wasSent(l.events, "nurturing_no_volvio") && !bl(l.whatsapp));

  // Already sent ones (candidates for our test)
  const sentS1 = s1.filter(l => wasSent(l.events, "nurturing_no_revisada") && !bl(l.whatsapp));
  const sentS1b = s1b.filter(l => wasSent(l.events, "nurturing_vio_no_activo") && !bl(l.whatsapp));
  const sentS2 = s2.filter(l => wasSent(l.events, "nurturing_no_volvio") && !bl(l.whatsapp));

  console.log("=== PENDIENTES (se enviarán mañana) ===");
  console.log(`  Escenario 1 (no revisó): ${pendingS1.length}`);
  console.log(`  Escenario 1b (vio, no activó): ${pendingS1b.length}`);
  console.log(`  Escenario 2 (activó, no volvió): ${pendingS2.length}`);

  console.log("\n=== YA ENVIADOS (candidatos para test) ===");
  console.log(`  Escenario 1: ${sentS1.length}`);
  console.log(`  Escenario 1b: ${sentS1b.length}`);
  console.log(`  Escenario 2: ${sentS2.length}`);

  // Pick 5 from each scenario (from already-sent, so we don't interfere with tomorrow)
  const pick1 = sentS1.slice(0, 5);
  const pick1b = sentS1b.slice(0, 5);
  const pick2 = sentS2.slice(0, 5);

  // If not enough already-sent, fill from pending (they'll get sent anyway)
  const need1 = 5 - pick1.length;
  const need1b = 5 - pick1b.length;
  const need2 = 5 - pick2.length;
  if (need1 > 0) pick1.push(...pendingS1.slice(0, need1));
  if (need1b > 0) pick1b.push(...pendingS1b.slice(0, need1b));
  if (need2 > 0) pick2.push(...pendingS2.slice(0, need2));

  const all = [
    ...pick1.map(l => ({ ...l, scenario: "carta_no_revisada", eventKey: "nurturing_no_revisada", template: "HX212aca9223fecaf089df099969e19a25" })),
    ...pick1b.map(l => ({ ...l, scenario: "vio_no_activo", eventKey: "nurturing_vio_no_activo", template: "HXe8201d69e53b2c6c4c2af79470c34845" })),
    ...pick2.map(l => ({ ...l, scenario: "no_volvio", eventKey: "nurturing_no_volvio", template: "HXe8201d69e53b2c6c4c2af79470c34845" })),
  ];

  console.log(`\n=== SELECCIONADOS PARA ENVIAR (${all.length}) ===`);
  for (const l of all) {
    const rest = await prisma.restaurant.findFirst({ where: { slug: l.generatedSlug! }, select: { name: true } });
    const name = rest?.name || l.localName || "?";
    console.log(`  [${l.scenario}] ${name} - ${l.ownerName} - ${l.whatsapp}`);
  }

  // Ask for confirmation
  const dryRun = !process.argv.includes("--send");
  if (dryRun) {
    console.log("\n⚠️  DRY RUN — agrega --send para enviar de verdad");
  } else {
    console.log("\n🚀 ENVIANDO...");
    const { sendWhatsApp } = await import("../src/lib/whatsapp");
    let ok = 0, fail = 0;
    for (const l of all) {
      const rest = await prisma.restaurant.findFirst({ where: { slug: l.generatedSlug! }, select: { name: true } });
      const restaurantName = rest?.name || l.localName || "tu restaurante";
      const ownerName = (l.ownerName || "Hola").split(" ")[0];
      try {
        const sid = await sendWhatsApp({
          to: l.whatsapp!,
          body: "",
          contentSid: l.template,
          contentVariables: { "1": ownerName, "2": restaurantName },
        });
        if (sid) {
          // Mark event so it doesn't get sent again
          const events = Array.isArray(l.events) ? (l.events as any[]) : [];
          if (!events.some((e: any) => e.action === l.eventKey)) {
            events.push({ ts: now.toISOString(), action: l.eventKey, scenario: l.scenario, sid });
            await prisma.lead.update({ where: { id: l.id }, data: { events: events as any } });
          }
          console.log(`  ✓ ${restaurantName} (${l.whatsapp}) — ${l.scenario}`);
          ok++;
        } else {
          console.log(`  ✗ ${restaurantName} (${l.whatsapp}) — sid null`);
          fail++;
        }
      } catch (e: any) {
        console.log(`  ✗ ${restaurantName} (${l.whatsapp}) — ${e.message}`);
        fail++;
      }
    }
    console.log(`\nResultado: ${ok} enviados, ${fail} fallidos`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
