import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Delete duplicate restaurant
  const dup = await p.restaurant.findFirst({ where: { slug: "el-menu-de-la-esquina-4rmb" } });
  if (dup) {
    await p.dish.deleteMany({ where: { restaurantId: dup.id } });
    await p.category.deleteMany({ where: { restaurantId: dup.id } });
    await p.statEvent.deleteMany({ where: { restaurantId: dup.id } });
    await p.session.deleteMany({ where: { restaurantId: dup.id } });
    await p.restaurant.update({ where: { id: dup.id }, data: { ownerId: null } }).catch(() => {});
    await p.restaurant.delete({ where: { id: dup.id } });
    console.log("Deleted duplicate restaurant el-menu-de-la-esquina-4rmb");
  }

  // Delete duplicate owner
  const dupOwner = await p.restaurantOwner.findUnique({ where: { email: "daniel_uchile_@hotmail.com" } });
  if (dupOwner) {
    await p.restaurantOwner.delete({ where: { id: dupOwner.id } });
    console.log("Deleted duplicate owner daniel_uchile_@hotmail.com");
  }

  // Delete failed lead
  const failedLead = await p.lead.findFirst({ where: { email: "daniel_uchile_@hotmail.com", cartaStatus: "FAILED" } });
  if (failedLead) {
    await p.lead.delete({ where: { id: failedLead.id } });
    console.log("Deleted failed lead");
  }

  console.log("Done.");
  await p.$disconnect();
}
main();
