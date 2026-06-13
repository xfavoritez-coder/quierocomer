import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const lead = await p.lead.findFirst({
    where: { localName: { contains: "helad", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead || !lead.generatedSlug) { console.log("Not found"); await p.$disconnect(); return; }

  const rest = await p.restaurant.findFirst({ where: { slug: lead.generatedSlug } });
  if (rest) {
    // Clear dishes so pipeline recreates them with HD photos
    const deleted = await p.dish.deleteMany({ where: { restaurantId: rest.id } });
    await p.category.deleteMany({ where: { restaurantId: rest.id } });
    console.log(`Cleared ${deleted.count} dishes + categories from ${rest.name}`);

    // Delete restaurant so pipeline creates fresh
    await p.statEvent.deleteMany({ where: { restaurantId: rest.id } });
    await p.session.deleteMany({ where: { restaurantId: rest.id } });
    await p.restaurant.update({ where: { id: rest.id }, data: { ownerId: null } }).catch(() => {});
    await p.restaurant.delete({ where: { id: rest.id } }).catch(e => console.log("Could not delete restaurant:", e.message));
  }

  await p.lead.update({
    where: { id: lead.id },
    data: { cartaStatus: "PENDING", errorLog: null, generatedSlug: null },
  });
  console.log("Reset lead to PENDING, ready for reprocess");
  console.log("Lead ID:", lead.id);
  await p.$disconnect();
}
main();
