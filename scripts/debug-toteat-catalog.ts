/**
 * Debug: dump the Toteat catalog Horus sees from /products and check
 * how a specific dish matches against it.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";
import { getToteatProductCatalog, normalizeName, nameSimilarity } from "../src/lib/toteat/mapping";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  if (!r) { console.error("not found"); return; }

  console.log("\n--- Catalog (live /products, activeOnly=true) ---");
  const catalog = await getToteatProductCatalog(r.id);
  console.log(`${catalog.length} products in catalog`);
  for (const p of catalog) {
    console.log(`  ${p.toteatProductId.padEnd(10)} ${p.name.padEnd(30)} ${p.hierarchyName || "-"}`);
  }

  console.log("\n--- Match score for unmapped dishes ---");
  const unmapped = await prisma.dish.findMany({
    where: { restaurantId: r.id, toteatProductId: null, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  for (const d of unmapped) {
    const dn = normalizeName(d.name);
    let best = { score: 0, entry: null as any };
    for (const c of catalog) {
      const s = nameSimilarity(dn, normalizeName(c.name));
      if (s > best.score) best = { score: s, entry: c };
    }
    console.log(`  ${d.name.padEnd(28)} → ${best.entry?.name || "NONE"} (${best.score}%)`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
