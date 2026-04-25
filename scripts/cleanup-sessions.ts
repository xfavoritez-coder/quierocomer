import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const total = await p.session.count();
  console.log(`Total antes: ${total}`);

  const deleted = await p.$executeRaw`
    DELETE FROM "Session"
    WHERE "pickedDishId" IS NULL
    AND ("dishesViewed" IS NULL OR "dishesViewed"::text = '[]')
    AND "searchesCount" = 0
  `;

  const remaining = await p.session.count();
  console.log(`Borradas: ${deleted}`);
  console.log(`Restantes: ${remaining}`);
  await p.$disconnect();
}
main();
