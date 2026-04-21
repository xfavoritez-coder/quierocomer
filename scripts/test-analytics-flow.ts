/**
 * Smoke Test: Analytics end-to-end flow
 * Run: npx tsx scripts/test-analytics-flow.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TS = Date.now();
const SLUG = `test-smoke-${TS}`;
const EMAIL = `smoke-${TS}@test.quierocomer.cl`;
const results: { step: string; ok: boolean; detail: string }[] = [];

function log(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${step}: ${detail}`);
  if (!ok) { printSummary(); process.exit(1); }
}

function printSummary() {
  console.log("\n=== SMOKE TEST RESULTS ===");
  results.forEach((r) => console.log(`${r.ok ? "✅" : "❌"} ${r.step}: ${r.detail}`));
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed === results.length ? "TODO OK" : "FAILED"} (${passed}/${results.length})`);
}

async function main() {
  try {
    // STEP 1: Create test restaurant
    const restaurant = await prisma.restaurant.create({
      data: { slug: SLUG, name: "Test Restaurant Smoke", qrActivatedAt: new Date(Date.now() - 15 * 86400000) },
    });
    const cat1 = await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Principales", position: 0 } });
    const cat2 = await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Postres", position: 1 } });
    const dishes = [];
    for (let i = 0; i < 5; i++) {
      dishes.push(await prisma.dish.create({
        data: { restaurantId: restaurant.id, categoryId: i < 3 ? cat1.id : cat2.id, name: `Test Dish ${i}`, price: 5000 + i * 1000, position: i },
      }));
    }
    log("Paso 1", true, `Restaurant "${SLUG}" + 5 dishes + 2 categories`);

    // STEP 2: Ghost visit
    const guestId = `test_guest_${TS}`;
    await prisma.guestProfile.create({ data: { id: guestId, deviceType: "mobile" } });
    const session = await prisma.session.create({
      data: { guestId, restaurantId: restaurant.id, deviceType: "mobile", startedAt: new Date(Date.now() - 600000), isReturningVisitor: false },
    });
    const s = await prisma.session.findUnique({ where: { id: session.id }, select: { isReturningVisitor: true } });
    log("Paso 2", s?.isReturningVisitor === false, `Session nueva, isReturningVisitor=${s?.isReturningVisitor}`);

    // STEP 3: Navigation events
    for (let i = 0; i < 3; i++) {
      await prisma.statEvent.create({ data: { eventType: "DISH_VIEW", restaurantId: restaurant.id, dishId: dishes[i].id, sessionId: session.id, guestId } });
    }
    await prisma.dishImpression.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({ sessionId: session.id, dishId: dishes[i % 5].id, restaurantId: restaurant.id, position: i, visibleMs: 1000 + i * 500 })),
    });
    await prisma.statEvent.create({ data: { eventType: "SEARCH_PERFORMED", restaurantId: restaurant.id, sessionId: session.id, guestId, query: "pizza", resultsCount: 2, clickedResultId: dishes[0].id } });
    await prisma.statEvent.create({ data: { eventType: "SEARCH_PERFORMED", restaurantId: restaurant.id, sessionId: session.id, guestId, query: "sushi inexistente", resultsCount: 0 } });
    await prisma.statEvent.create({ data: { eventType: "FILTER_APPLIED", restaurantId: restaurant.id, sessionId: session.id, guestId, resultsCount: 3, metadata: { filterType: "category", filterValue: "Principal" } } });

    const evCount = await prisma.statEvent.count({ where: { sessionId: session.id } });
    const impCount = await prisma.dishImpression.count({ where: { sessionId: session.id } });
    const searchEvent = await prisma.statEvent.findFirst({ where: { sessionId: session.id, eventType: "SEARCH_PERFORMED", query: "sushi inexistente" } });
    log("Paso 3", evCount === 6 && impCount === 10 && searchEvent?.resultsCount === 0, `${evCount} StatEvents + ${impCount} DishImpressions`);

    // STEP 4: Genio interaction
    const genioSessionId = `test_genio_${TS}`;
    await prisma.statEvent.create({ data: { eventType: "GENIO_START", restaurantId: restaurant.id, sessionId: session.id, guestId, genioSessionId } });
    await prisma.statEvent.create({ data: { eventType: "GENIO_COMPLETE", restaurantId: restaurant.id, sessionId: session.id, guestId, genioSessionId, dishId: dishes[0].id } });
    await prisma.statEvent.create({ data: { eventType: "GENIO_DISH_ACCEPTED", restaurantId: restaurant.id, sessionId: session.id, guestId, genioSessionId, dishId: dishes[0].id } });
    const genioEvents = await prisma.statEvent.findMany({ where: { genioSessionId } });
    const allSameId = genioEvents.every((e) => e.genioSessionId === genioSessionId);
    log("Paso 4", genioEvents.length === 3 && allSameId, `Genio tracked e2e, genioSessionId=${genioSessionId.slice(0, 20)}...`);

    // STEP 5: Favorites as ghost
    for (let i = 0; i < 3; i++) {
      await prisma.dishFavorite.create({ data: { guestId, dishId: dishes[i].id, restaurantId: restaurant.id } });
      await prisma.statEvent.create({ data: { eventType: "DISH_FAVORITED", restaurantId: restaurant.id, sessionId: session.id, guestId, dishId: dishes[i].id, metadata: { favorites_count_after: i + 1 } } });
    }
    const ghostFavs = await prisma.dishFavorite.findMany({ where: { guestId } });
    log("Paso 5", ghostFavs.length === 3 && ghostFavs.every((f) => f.qrUserId === null), `3 favoritos como fantasma`);

    // STEP 6: Registration + conversion
    const user = await prisma.qRUser.create({ data: { email: EMAIL, name: "Test User" } });
    // Link guest
    await prisma.guestProfile.update({ where: { id: guestId }, data: { linkedQrUserId: user.id } });
    // Backfill
    await prisma.statEvent.updateMany({ where: { guestId, qrUserId: null }, data: { qrUserId: user.id } });
    await prisma.session.updateMany({ where: { guestId, qrUserId: null }, data: { qrUserId: user.id } });

    // Track registration
    await prisma.statEvent.create({
      data: { eventType: "USER_REGISTERED", restaurantId: restaurant.id, sessionId: session.id, guestId, qrUserId: user.id, metadata: { triggered_by: "favorites_threshold", previous_guest_id: guestId } },
    });
    await prisma.guestProfile.update({ where: { id: guestId }, data: { convertedToUserAt: new Date() } });
    await prisma.session.update({ where: { id: session.id }, data: { converted: true } });

    // Migrate favorites
    await prisma.dishFavorite.updateMany({ where: { guestId }, data: { qrUserId: user.id, guestId: null } });

    // Verify
    const guest = await prisma.guestProfile.findUnique({ where: { id: guestId } });
    const sess = await prisma.session.findUnique({ where: { id: session.id } });
    const regEvent = await prisma.statEvent.findFirst({ where: { eventType: "USER_REGISTERED", qrUserId: user.id } });
    const migratedFavs = await prisma.dishFavorite.findMany({ where: { qrUserId: user.id } });
    const ghostFavsAfter = await prisma.dishFavorite.findMany({ where: { guestId } });

    const step6ok = !!guest?.convertedToUserAt && guest?.linkedQrUserId === user.id && sess?.converted === true
      && regEvent?.metadata !== null && migratedFavs.length === 3 && ghostFavsAfter.length === 0;
    log("Paso 6", step6ok, `Conversión exitosa. Favoritos migrados: ${migratedFavs.length}/3`);

    // STEP 7: Session close
    await prisma.session.update({
      where: { id: session.id },
      data: { endedAt: new Date(), durationMs: 600000, searchesCount: 2, isAbandoned: false },
    });
    const closedSession = await prisma.session.findUnique({ where: { id: session.id } });
    log("Paso 7", !!closedSession?.endedAt && closedSession?.durationMs === 600000 && closedSession?.searchesCount === 2, `Sesión cerrada con métricas`);

    // STEP 8: Return visit
    await prisma.guestProfile.update({ where: { id: guestId }, data: { visitCount: 2 } });
    const session2 = await prisma.session.create({
      data: { guestId, qrUserId: user.id, restaurantId: restaurant.id, deviceType: "mobile", isReturningVisitor: true },
    });
    const s2 = await prisma.session.findUnique({ where: { id: session2.id }, select: { isReturningVisitor: true } });
    log("Paso 8", s2?.isReturningVisitor === true, `Visita recurrente detectada`);

    printSummary();
  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
