import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const id = "cmphd2j450045il04e851z427"; // tres-toques-2j3k duplicate

  // Delete dependents
  await p.dish.deleteMany({ where: { restaurantId: id } });
  await p.category.deleteMany({ where: { restaurantId: id } });
  await p.statEvent.deleteMany({ where: { restaurantId: id } });
  await p.session.deleteMany({ where: { restaurantId: id } });

  // Unlink owner if shared
  await p.restaurant.update({ where: { id }, data: { ownerId: null } }).catch(() => {});

  await p.restaurant.delete({ where: { id } });
  console.log("Deleted duplicate: tres-toques-2j3k");
  await p.$disconnect();
}
main();
