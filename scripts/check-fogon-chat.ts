import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Find Fogon del Puerto
  const rest = await p.restaurant.findFirst({
    where: { name: { contains: "fogon", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, plan: true, isActive: true, isDemo: true, subscriptionStatus: true },
  });
  if (!rest) { console.log("No encontrado"); await p.$disconnect(); return; }
  console.log("Restaurant:", rest.name, "| plan:", rest.plan, "| active:", rest.isActive, "| demo:", rest.isDemo, "| status:", rest.subscriptionStatus);

  const owner = await p.restaurantOwner.findFirst({
    where: { restaurants: { some: { id: rest.id } } },
    select: { whatsapp: true, name: true },
  });
  console.log("Owner:", owner?.name, "| wa:", owner?.whatsapp);

  const sessions7d = await p.session.count({ where: { restaurantId: rest.id, startedAt: { gte: new Date(Date.now() - 7 * 86400000) } } });
  console.log("Sessions 7d:", sessions7d);
  console.log("Mode:", sessions7d >= 50 ? "SUPPORT" : "SALES");

  // Get all WA messages
  if (owner?.whatsapp) {
    const phone = owner.whatsapp.replace("+", "");
    const msgs = await p.whatsAppMessage.findMany({
      where: { phone: { contains: phone } },
      select: { direction: true, body: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("\n=== CONVERSACION (" + msgs.length + " mensajes) ===");
    for (const m of msgs) {
      console.log(`\n[${m.direction}] ${m.createdAt.toISOString()}`);
      console.log(m.body);
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
