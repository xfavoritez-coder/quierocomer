import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const leads = await p.lead.findMany({ orderBy: { createdAt: "asc" } });

  // Get restaurants for slug lookup
  const restaurants = await p.restaurant.findMany({
    select: {
      slug: true, id: true, isDemo: true, plan: true,
      _count: { select: { dishes: true, statEvents: true, categories: true } },
    },
  });
  const rBySlug = new Map(restaurants.map(r => [r.slug, r]));

  // Count: activated vs not
  const activated = leads.filter(l => l.activatedAt);
  const notActivated = leads.filter(l => !l.activatedAt);

  console.log(`Total leads: ${leads.length}`);
  console.log(`Activados: ${activated.length}`);
  console.log(`NO activados: ${notActivated.length}`);

  // Separate not-activated by whether carta is ready
  const withCarta = notActivated.filter(l => ["READY", "DELIVERED"].includes(l.cartaStatus));
  const withoutCarta = notActivated.filter(l => !["READY", "DELIVERED"].includes(l.cartaStatus));

  console.log(`  → Con carta lista: ${withCarta.length}`);
  console.log(`  → Sin carta lista: ${withoutCarta.length}`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  LISTA COMPLETA: NO ACTIVADOS CON CARTA LISTA");
  console.log("  (Estos reciben el email de reactivacion)");
  console.log("═══════════════════════════════════════════════════════\n");

  let emailCount = 0;
  for (const l of withCarta) {
    const r = l.generatedSlug ? rBySlug.get(l.generatedSlug) : null;
    const ev = r?._count.statEvents || 0;
    const pl = r?._count.dishes || 0;
    const cats = r?._count.categories || 0;
    const onb = l.onboardingDoneAt ? "✓" : "✗";
    const pan = l.panelVisitedAt ? "✓" : "✗";
    const act = l.activarVisitedAt ? "✓" : "✗";
    emailCount++;

    console.log(`${emailCount}. ${l.localName}`);
    console.log(`   Email: ${l.email} | WA: ${l.whatsapp || "-"}`);
    console.log(`   Owner: ${l.ownerName} | Slug: /${l.generatedSlug || "?"}`);
    console.log(`   Onboarding: ${onb} | Panel: ${pan} | Visitó /activar: ${act}`);
    console.log(`   Contenido: ${cats} categorías, ${pl} platos`);
    console.log(`   Uso QR real: ${ev} eventos de clientes`);
    console.log("");
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  SIN CARTA LISTA (necesitan intervención manual)");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const l of withoutCarta) {
    console.log(`  ${l.localName} [${l.cartaStatus}] — ${l.email} — WA: ${l.whatsapp || "-"}`);
  }

  // Emails duplicados entre activados y no-activados?
  const activatedEmails = new Set(activated.map(l => l.email));
  const dupes = withCarta.filter(l => activatedEmails.has(l.email));
  if (dupes.length > 0) {
    console.log("\n⚠ EMAILS DUPLICADOS (ya activaron con otro lead):");
    for (const d of dupes) console.log(`  ${d.localName} — ${d.email}`);
  }

  // Duplicate emails within not-activated
  const emailCounts = new Map<string, string[]>();
  for (const l of notActivated) {
    if (!emailCounts.has(l.email)) emailCounts.set(l.email, []);
    emailCounts.get(l.email)!.push(l.localName);
  }
  const internalDupes = [...emailCounts.entries()].filter(([, names]) => names.length > 1);
  if (internalDupes.length > 0) {
    console.log("\n⚠ MISMA PERSONA, MULTIPLES LEADS:");
    for (const [email, names] of internalDupes) console.log(`  ${email}: ${names.join(", ")}`);
  }

  // Duplicate WhatsApp numbers
  const waCounts = new Map<string, string[]>();
  for (const l of notActivated) {
    if (!l.whatsapp) continue;
    const norm = l.whatsapp.replace(/\D/g, "");
    if (!waCounts.has(norm)) waCounts.set(norm, []);
    waCounts.get(norm)!.push(l.localName);
  }
  const waDupes = [...waCounts.entries()].filter(([, names]) => names.length > 1);
  if (waDupes.length > 0) {
    console.log("\n⚠ MISMO WHATSAPP, MULTIPLES LEADS:");
    for (const [wa, names] of waDupes) console.log(`  +${wa}: ${names.join(", ")}`);
  }

  await p.$disconnect();
}

main().catch(console.error);
