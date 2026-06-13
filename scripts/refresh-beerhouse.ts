import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const slug = "beer-house-atacama";

  const rest = await p.restaurant.findFirst({ where: { slug } });
  if (!rest) { console.log("Not found"); await p.$disconnect(); return; }

  // Clear dishes and categories only
  const deleted = await p.dish.deleteMany({ where: { restaurantId: rest.id } });
  await p.category.deleteMany({ where: { restaurantId: rest.id } });
  console.log(`Cleared ${deleted.count} dishes + categories`);

  // Delete restaurant so pipeline creates fresh with HD photos
  // But preserve owner link
  const ownerId = rest.ownerId;
  await p.statEvent.deleteMany({ where: { restaurantId: rest.id } });
  await p.session.deleteMany({ where: { restaurantId: rest.id } });
  await p.restaurant.update({ where: { id: rest.id }, data: { ownerId: null } }).catch(() => {});
  await p.restaurant.delete({ where: { id: rest.id } }).catch(e => console.log("Delete failed:", e.message));

  // Reset lead to PENDING but keep all timestamps intact
  const lead = await p.lead.findFirst({ where: { generatedSlug: slug }, orderBy: { createdAt: "desc" } });
  if (lead) {
    await p.lead.update({
      where: { id: lead.id },
      data: { cartaStatus: "PENDING", errorLog: null, generatedSlug: null },
    });
    console.log("Lead reset to PENDING (timestamps preserved)");
    console.log("Lead ID:", lead.id);
  }

  await p.$disconnect();
}
main();
