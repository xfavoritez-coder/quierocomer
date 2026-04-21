/**
 * Cleanup all test data created by smoke test and seed scripts
 * Run: npx tsx scripts/cleanup-test-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning up test data...\n");

  // Find test restaurants
  const testRestaurants = await prisma.restaurant.findMany({
    where: { OR: [{ slug: { startsWith: "test-smoke-" } }, { slug: "demo-oasis" }] },
    select: { id: true, slug: true },
  });

  const restaurantIds = testRestaurants.map((r) => r.id);
  console.log(`Found ${testRestaurants.length} test restaurants: ${testRestaurants.map((r) => r.slug).join(", ")}`);

  if (restaurantIds.length === 0) {
    console.log("Nothing to clean up.");
    await prisma.$disconnect();
    return;
  }

  // Delete in correct order (respect foreign keys)
  const counts: Record<string, number> = {};

  // DishImpressions (no FK to Dish, just IDs)
  const r1 = await prisma.dishImpression.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["DishImpression"] = r1.count;

  // RestaurantTickets
  const r2 = await prisma.restaurantTicket.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["RestaurantTicket"] = r2.count;

  // DishFavorites
  const r3 = await prisma.dishFavorite.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["DishFavorite"] = r3.count;

  // StatEvents
  const r4 = await prisma.statEvent.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["StatEvent"] = r4.count;

  // Sessions
  const r5 = await prisma.session.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["Session"] = r5.count;

  // QRUserInteractions
  const r6 = await prisma.qRUserInteraction.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["QRUserInteraction"] = r6.count;

  // Test QRUsers
  const r7 = await prisma.qRUser.deleteMany({ where: { email: { endsWith: "@test.quierocomer.cl" } } });
  counts["QRUser"] = r7.count;

  // Test GuestProfiles
  const r8 = await prisma.guestProfile.deleteMany({
    where: { OR: [{ id: { startsWith: "test_guest_" } }, { id: { startsWith: "demo_guest_" } }] },
  });
  counts["GuestProfile"] = r8.count;

  // Dishes
  const r9 = await prisma.dish.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["Dish"] = r9.count;

  // Categories
  const r10 = await prisma.category.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  counts["Category"] = r10.count;

  // Restaurants
  const r11 = await prisma.restaurant.deleteMany({ where: { id: { in: restaurantIds } } });
  counts["Restaurant"] = r11.count;

  console.log("\n=== CLEANUP RESULTS ===");
  let total = 0;
  for (const [table, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${table}: ${count} deleted`);
    total += count;
  }
  console.log(`\n✅ Total: ${total} records deleted`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("❌ FATAL:", e); process.exit(1); });
