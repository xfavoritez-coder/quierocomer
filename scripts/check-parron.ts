import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Find lead
  const leads = await prisma.lead.findMany({
    where: { OR: [
      { localName: { contains: "parr", mode: "insensitive" } },
      { generatedSlug: { contains: "parron" } },
    ] },
    select: {
      id: true, localName: true, ownerName: true, email: true, whatsapp: true,
      cartaUrl: true, cartaStatus: true, generatedSlug: true,
      activatedAt: true, onboardingDoneAt: true, panelVisitedAt: true,
      deliveredAt: true, readyAt: true, completedAt: true, step2At: true,
      events: true, createdAt: true,
    },
  });
  console.log("Leads found:", leads.length);
  for (const l of leads) {
    console.log(JSON.stringify(l, null, 2));
  }

  // Find restaurant
  const restaurants = await prisma.restaurant.findMany({
    where: { OR: [
      { name: { contains: "parr", mode: "insensitive" } },
      { slug: { contains: "parron" } },
    ] },
    select: {
      id: true, name: true, slug: true, isDemo: true, plan: true,
      subscriptionStatus: true, ownerId: true,
      owner: { select: { id: true, name: true, email: true, whatsapp: true } },
      createdAt: true, updatedAt: true,
    },
  });
  console.log("\nRestaurants found:", restaurants.length);
  for (const r of restaurants) {
    console.log(JSON.stringify(r, null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
