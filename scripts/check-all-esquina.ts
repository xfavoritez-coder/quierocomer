import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // All leads from this person
  const leads = await p.lead.findMany({
    where: { OR: [
      { localName: { contains: "esquina", mode: "insensitive" } },
      { email: { contains: "daniel_uchile", mode: "insensitive" } },
      { email: { contains: "dc_daniel_carrizo", mode: "insensitive" } },
    ]},
    orderBy: { createdAt: "asc" },
    select: { id: true, localName: true, cartaType: true, cartaUrl: true, cartaStatus: true, email: true, ownerName: true, generatedSlug: true, createdAt: true, onboardingDoneAt: true, panelVisitedAt: true, activarVisitedAt: true, activatedAt: true, whatsapp: true, errorLog: true },
  });
  console.log(`Found ${leads.length} leads:`);
  for (const l of leads) {
    console.log(`\n${l.localName} | ${l.cartaStatus} | ${l.email}`);
    console.log(`  Type: ${l.cartaType} | URL: ${l.cartaUrl?.slice(0, 70) || "—"}`);
    console.log(`  Slug: ${l.generatedSlug} | WA: ${l.whatsapp}`);
    console.log(`  Created: ${l.createdAt.toISOString()}`);
    console.log(`  Onboard: ${l.onboardingDoneAt?.toISOString() || "—"} | Panel: ${l.panelVisitedAt?.toISOString() || "—"} | Activar: ${l.activarVisitedAt?.toISOString() || "—"} | Activated: ${l.activatedAt?.toISOString() || "—"}`);
    if (l.errorLog) console.log(`  Error: ${l.errorLog}`);
  }

  // All restaurants
  const rests = await p.restaurant.findMany({
    where: { OR: [
      { name: { contains: "esquina", mode: "insensitive" } },
      { slug: { contains: "esquina" } },
    ]},
    select: { id: true, name: true, slug: true, isDemo: true, isActive: true, plan: true, createdAt: true, ownerId: true, _count: { select: { dishes: true } } },
  });
  console.log(`\n\nRestaurants (${rests.length}):`);
  for (const r of rests) {
    console.log(`  ${r.name} | slug: ${r.slug} | demo: ${r.isDemo} | active: ${r.isActive} | plan: ${r.plan} | dishes: ${r._count.dishes} | created: ${r.createdAt.toISOString()}`);
  }

  // Owners
  const owners = await p.restaurantOwner.findMany({
    where: { OR: [
      { email: { contains: "daniel_uchile", mode: "insensitive" } },
      { email: { contains: "dc_daniel_carrizo", mode: "insensitive" } },
    ]},
    select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true, restaurants: { select: { name: true, slug: true } } },
  });
  console.log(`\nOwners (${owners.length}):`);
  for (const o of owners) {
    console.log(`  ${o.name} | ${o.email} | login: ${o.lastLoginAt?.toISOString() || "NEVER"} | created: ${o.createdAt.toISOString()}`);
    for (const r of o.restaurants) console.log(`    → ${r.name} (${r.slug})`);
  }

  await p.$disconnect();
}
main();
