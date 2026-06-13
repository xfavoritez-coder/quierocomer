import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Search leads broadly
  const leads = await p.lead.findMany({
    where: { OR: [
      { localName: { contains: "fog", mode: "insensitive" } },
      { localName: { contains: "puerto", mode: "insensitive" } },
      { ownerName: { contains: "fog", mode: "insensitive" } },
    ]},
    select: { id: true, ownerName: true, localName: true, whatsapp: true, cartaStatus: true },
  });
  console.log("LEADS:", JSON.stringify(leads, null, 2));

  // Search restaurants
  const rests = await p.restaurant.findMany({
    where: { OR: [
      { name: { contains: "fog", mode: "insensitive" } },
      { name: { contains: "puerto", mode: "insensitive" } },
    ]},
    select: { id: true, name: true, slug: true },
  });
  console.log("RESTAURANTS:", JSON.stringify(rests, null, 2));

  // Get all WA conversations that have INBOUND messages (actual conversations)
  const convos = await p.whatsAppMessage.findMany({
    where: { direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { phone: true, body: true, createdAt: true, profileName: true, leadId: true, restaurantId: true },
  });
  
  // Group by phone
  const phones = new Set<string>();
  console.log("\nRecent INBOUND messages:");
  for (const c of convos) {
    if (!phones.has(c.phone)) {
      phones.add(c.phone);
      // Get lead info for this phone
      const lead = c.leadId ? await p.lead.findUnique({ where: { id: c.leadId }, select: { localName: true, ownerName: true } }) : null;
      console.log(`  ${c.phone} | ${lead?.localName || "?"} | ${lead?.ownerName || "?"} | ${c.body.substring(0, 60)} | ${c.createdAt.toISOString()}`);
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
