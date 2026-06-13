import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // Fake promos: exactly 15% discount AND name ends with "en oferta"
  const fakes = await p.promotion.findMany({
    where: { discountPct: 15, name: { endsWith: "en oferta" } },
    select: { id: true, name: true, restaurantId: true },
  });
  console.log(`Found ${fakes.length} fake promos to delete:\n`);
  for (const f of fakes) {
    const rest = await p.restaurant.findUnique({ where: { id: f.restaurantId }, select: { name: true } });
    console.log(`  ${rest?.name?.padEnd(30)} | ${f.name}`);
  }

  if (fakes.length > 0) {
    const deleted = await p.promotion.deleteMany({
      where: { id: { in: fakes.map(f => f.id) } },
    });
    console.log(`\nDeleted: ${deleted.count}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
