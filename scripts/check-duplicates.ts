import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const rests = await p.restaurant.findMany({
    where: { name: { contains: "tres toques", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, isDemo: true, isActive: true, plan: true, createdAt: true, updatedAt: true, ownerId: true, _count: { select: { dishes: true } } },
  });
  for (const r of rests) {
    console.log(`${r.name} | slug: ${r.slug} | demo: ${r.isDemo} | active: ${r.isActive} | plan: ${r.plan} | dishes: ${r._count.dishes} | created: ${r.createdAt.toISOString()} | id: ${r.id}`);
  }

  // Check leads
  const leads = await p.lead.findMany({
    where: { localName: { contains: "tres toques", mode: "insensitive" } },
    select: { id: true, localName: true, generatedSlug: true, cartaStatus: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("\nLeads:");
  for (const l of leads) {
    console.log(`  ${l.localName} | ${l.cartaStatus} | slug: ${l.generatedSlug} | ${l.email} | ${l.createdAt.toISOString()}`);
  }

  await p.$disconnect();
}
main();
