import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const restaurants = await p.restaurant.findMany({
    select: { id: true, name: true, slug: true, isDemo: true, ownerId: true, owner: { select: { whatsapp: true } } },
  });

  // Get all restaurants that have received nurturing
  const nurtured = await p.panelActivity.findMany({
    where: { action: { startsWith: "nurturing_" } },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });
  const nurturedIds = new Set(nurtured.map(n => n.restaurantId));

  // Also check leads for WA
  const leads = await p.lead.findMany({
    where: { generatedSlug: { not: null } },
    select: { generatedSlug: true, whatsapp: true },
  });
  const leadWaBySlug = new Map<string, string>();
  for (const l of leads) { if (l.generatedSlug && l.whatsapp) leadWaBySlug.set(l.generatedSlug, l.whatsapp); }

  const sinNurturing: { name: string; wa: string | null; motivo: string }[] = [];

  for (const r of restaurants) {
    if (nurturedIds.has(r.id)) continue;
    const wa = r.owner?.whatsapp || leadWaBySlug.get(r.slug) || null;
    let motivo = wa ? "TIENE WA" : "SIN WA";
    sinNurturing.push({ name: r.name, wa, motivo });
  }

  const conWa = sinNurturing.filter(s => s.wa);
  const sinWa = sinNurturing.filter(s => !s.wa);

  console.log(`=== RESTAURANTS SIN NURTURING: ${sinNurturing.length} de ${restaurants.length} ===\n`);
  console.log(`Con WhatsApp (se podría enviar): ${conWa.length}`);
  console.log(`Sin WhatsApp (no se puede enviar): ${sinWa.length}\n`);

  console.log("--- CON WHATSAPP ---");
  for (const s of conWa) console.log(`  ${s.name.padEnd(35)} ${s.wa}`);

  console.log("\n--- SIN WHATSAPP ---");
  for (const s of sinWa) console.log(`  ${s.name}`);

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
