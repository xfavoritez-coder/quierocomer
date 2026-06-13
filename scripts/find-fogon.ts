import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rests = await p.restaurant.findMany({ where: { name: { contains: "fog", mode: "insensitive" } }, select: { id: true, name: true, slug: true, plan: true, isActive: true, isDemo: true, subscriptionStatus: true } });
  console.log("Restaurants:", JSON.stringify(rests, null, 2));
  const leads = await p.lead.findMany({ where: { localName: { contains: "fog", mode: "insensitive" } }, select: { localName: true, whatsapp: true, generatedSlug: true } });
  console.log("Leads:", JSON.stringify(leads, null, 2));

  // Search in WhatsAppMessage for fogon
  const msgs = await p.whatsAppMessage.findMany({
    where: { body: { contains: "fog", mode: "insensitive" } },
    select: { phone: true, direction: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("\nWA messages mentioning 'fog':", msgs.length);
  for (const m of msgs) {
    console.log(`  [${m.direction}] ${m.phone} | ${m.body.substring(0, 80)} | ${m.createdAt.toISOString()}`);
  }

  // Also search by "Fogón"
  const rests2 = await p.restaurant.findMany({ where: { name: { contains: "Fogo", mode: "insensitive" } }, select: { id: true, name: true, slug: true } });
  console.log("\nWith 'Fogo':", JSON.stringify(rests2));

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
