/** Debug: dump getTopDishIds result for Horus to verify the badge logic. */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";
import { getTopDishIds } from "../src/lib/qr/utils/getTopDishIds";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  if (!r) return;

  const result = await getTopDishIds(r.id);
  console.log(`source: ${result.source}`);
  console.log(`totalSalesToday: ${result.totalSalesToday}`);
  console.log(`dishIds (${result.dishIds.size}):`);

  if (result.dishIds.size > 0) {
    const dishes = await prisma.dish.findMany({
      where: { id: { in: Array.from(result.dishIds) } },
      select: { id: true, name: true, toteatProductId: true, category: { select: { name: true } } },
    });
    for (const d of dishes) {
      console.log(`  ${d.name.padEnd(28)} (${d.toteatProductId || "-"}) · ${d.category?.name}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
