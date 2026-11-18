import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // 1. Legacy pattern: exactly 15% discount AND name ends with "en oferta"
  const legacyFakes = await p.promotion.findMany({
    where: { discountPct: 15, name: { endsWith: "en oferta" } },
    select: { id: true, name: true, restaurantId: true, status: true },
  });

  // 2. AI-generated SUGGESTED promos (never approved, shouldn't exist publicly)
  const aiSuggested = await p.promotion.findMany({
    where: { generatedBy: "ai", status: "SUGGESTED" },
    select: { id: true, name: true, restaurantId: true, status: true },
  });

  // 3. AI-generated promos with empty dishIds (hallucinated dishes that didn't match)
  const aiEmpty = await p.promotion.findMany({
    where: { generatedBy: "ai", dishIds: { isEmpty: true } },
    select: { id: true, name: true, restaurantId: true, status: true },
  });

  // Deduplicate
  const allIds = new Set<string>();
  const all = [...legacyFakes, ...aiSuggested, ...aiEmpty].filter(f => {
    if (allIds.has(f.id)) return false;
    allIds.add(f.id);
    return true;
  });

  console.log(`Found ${all.length} fake/orphan promos to delete:\n`);
  console.log(`  - Legacy "en oferta" pattern: ${legacyFakes.length}`);
  console.log(`  - AI SUGGESTED (never approved): ${aiSuggested.length}`);
  console.log(`  - AI with empty dishIds: ${aiEmpty.length}`);
  console.log();

  for (const f of all) {
    const rest = await p.restaurant.findUnique({ where: { id: f.restaurantId }, select: { name: true } });
    console.log(`  ${(rest?.name || "???").padEnd(30)} | [${f.status}] ${f.name}`);
  }

  if (all.length > 0) {
    const deleted = await p.promotion.deleteMany({
      where: { id: { in: all.map(f => f.id) } },
    });
    console.log(`\nDeleted: ${deleted.count}`);
  } else {
    console.log("\nNothing to delete.");
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
