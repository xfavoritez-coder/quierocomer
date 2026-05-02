/**
 * One-shot script: run auto-map for Horus to seed initial dish↔Toteat links.
 * Usage: npx tsx scripts/run-auto-map.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";
import { autoMapRestaurantDishes } from "../src/lib/toteat/mapping";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  if (!r) {
    console.error("Restaurant horusvegan not found");
    process.exit(1);
  }
  console.log(`Auto-mapping dishes for ${r.name} (${r.id})...`);
  const results = await autoMapRestaurantDishes(r.id, { force: true });

  const matched = results.filter((x) => x.status === "matched");
  const candidates = results.filter((x) => x.status === "candidate");
  const unmapped = results.filter((x) => x.status === "unmapped");

  console.log(`✅ Matched: ${matched.length}`);
  for (const m of matched) console.log(`   ${m.dishName.padEnd(30)} → ${m.toteatName} (${m.score}%)`);

  console.log(`⚠️  Candidates: ${candidates.length}`);
  for (const c of candidates) console.log(`   ${c.dishName.padEnd(30)} ~ ${c.toteatName} (${c.score}%)`);

  console.log(`✗ Unmapped: ${unmapped.length}`);
  for (const u of unmapped) console.log(`   ${u.dishName}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
