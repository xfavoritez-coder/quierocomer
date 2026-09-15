/**
 * Backfill: pull the last N days of Toteat sales for Horus into the local cache.
 * Toteat caps /sales queries at 15 days, so we chunk if needed.
 * Usage: npx tsx scripts/backfill-toteat.ts [days=14]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";
import { syncRestaurantSales, loadCredentialsFromRestaurant } from "../src/lib/toteat/sync";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  if (!r) { console.error("Restaurant not found"); return; }

  const credentials = await loadCredentialsFromRestaurant(r.id, true);
  if (!credentials) { console.error("No credentials"); return; }

  // Start from the first QC session — never sync data from before QC was active
  const firstSession = await prisma.session.findFirst({
    where: { restaurantId: r.id },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  if (!firstSession) { console.error("No QC sessions yet for this restaurant"); return; }

  const to = new Date();
  let from = firstSession.startedAt;
  const totalDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

  console.log(`Backfilling Toteat sales for ${r.name}`);
  console.log(`From first QC session: ${from.toISOString()}`);
  console.log(`To now:                ${to.toISOString()}`);
  console.log(`Total days: ${totalDays}\n`);

  // Toteat caps queries at 15 days, so chunk in 14-day windows to be safe
  let totalUpserted = 0;
  let chunkStart = from;
  while (chunkStart < to) {
    const chunkEnd = new Date(Math.min(chunkStart.getTime() + 14 * 24 * 60 * 60 * 1000, to.getTime()));
    const result = await syncRestaurantSales({
      restaurantId: r.id,
      credentials,
      from: chunkStart,
      to: chunkEnd,
    });
    console.log(`  Chunk ${result.rangeIni} → ${result.rangeEnd}: ${result.upserted} upserted, ${result.skipped} skipped`);
    if (!result.ok) {
      console.log(`  ⚠️ chunk failed: ${result.error}`);
      break;
    }
    totalUpserted += result.upserted;
    if (chunkEnd >= to) break;
    chunkStart = new Date(chunkEnd.getTime() + 1000); // 1s overlap
    // Wait a bit to avoid Toteat rate limit (3 req/min)
    await new Promise((r) => setTimeout(r, 25_000));
  }

  console.log(`\n✅ Done. Total upserted: ${totalUpserted}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
