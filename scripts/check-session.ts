import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Count sessions with categories but no dishes
  const count = await p.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "Session"
    WHERE "pickedDishId" IS NULL
    AND ("dishesViewed" IS NULL OR "dishesViewed"::text = '[]')
    AND "searchesCount" = 0
  `;
  console.log(`Sesiones con 0 platos vistos, 0 búsquedas, sin pick: ${count[0].count}`);

  const total = await p.session.count();
  console.log(`Total: ${total}`);

  await p.$disconnect();
}
main();
