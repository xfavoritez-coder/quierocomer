/**
 * Seed realistic demo data for analytics dashboard
 * Run: npx tsx scripts/seed-analytics-demo.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "demo-oasis";
const DAY = 86400000;
const NOW = Date.now();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[rand(0, arr.length - 1)]; }
function daysAgo(d: number) { return new Date(NOW - d * DAY); }

async function main() {
  // Check idempotency
  const existing = await prisma.restaurant.findUnique({ where: { slug: SLUG } });
  if (existing) { console.log("⚠️ Demo Oasis already exists. Skipping seed."); await prisma.$disconnect(); return; }

  console.log("🌱 Seeding Demo Oasis...");

  // Restaurant
  const rest = await prisma.restaurant.create({
    data: { slug: SLUG, name: "Demo Oasis", description: "Restaurant demo para analytics", qrActivatedAt: daysAgo(25) },
  });

  // Categories
  const cats = [];
  for (const [i, name] of ["Principales", "Entradas", "Postres", "Bebidas"].entries()) {
    cats.push(await prisma.category.create({ data: { restaurantId: rest.id, name, position: i } }));
  }

  // Dishes
  const dishNames = [
    ["Lomo saltado", "Ceviche mixto", "Arroz chaufa", "Pollo a la brasa"],
    ["Causa limeña", "Anticuchos", "Papa rellena"],
    ["Suspiro limeño", "Tres leches", "Mazamorra morada", "Picarones"],
    ["Chicha morada", "Pisco sour", "Limonada", "Cerveza artesanal"],
  ];
  const dishes: any[] = [];
  for (let c = 0; c < 4; c++) {
    for (let d = 0; d < dishNames[c].length; d++) {
      dishes.push(await prisma.dish.create({
        data: { restaurantId: rest.id, categoryId: cats[c].id, name: dishNames[c][d], price: rand(5000, 18000), position: d },
      }));
    }
  }

  // 50 Guests
  const guests: { id: string; createdDaysAgo: number }[] = [];
  for (let i = 0; i < 50; i++) {
    const dAgo = rand(1, 30);
    const gId = `demo_guest_${i}_${NOW}`;
    const deviceType = i < 40 ? "mobile" : i < 47 ? "desktop" : "tablet";
    await prisma.guestProfile.create({ data: { id: gId, createdAt: daysAgo(dAgo), lastSeenAt: daysAgo(Math.max(0, dAgo - rand(0, 5))), visitCount: 1, deviceType } });
    guests.push({ id: gId, createdDaysAgo: dAgo });
  }

  // Sessions + Events
  let totalSessions = 0;
  let totalEvents = 0;
  let totalImpressions = 0;
  const genioGuests = new Set<number>();

  // Which guests are returning
  const returningGuests = guests.slice(0, 20); // first 20 return
  const thirdVisitGuests = guests.slice(0, 8); // first 8 get third visit

  for (let i = 0; i < 50; i++) {
    const g = guests[i];
    const hasGenio = Math.random() < 0.3;
    if (hasGenio) genioGuests.add(i);

    // First visit
    const s1 = await prisma.session.create({
      data: {
        guestId: g.id, restaurantId: rest.id, deviceType: "mobile",
        startedAt: daysAgo(g.createdDaysAgo), durationMs: rand(30000, 300000),
        isReturningVisitor: false,
        dishesViewed: dishes.slice(0, rand(2, 5)).map((d: any) => ({ dishId: d.id, dwellMs: rand(1000, 5000) })),
      },
    });
    totalSessions++;

    // Navigation events
    const dishViewCount = rand(2, 5);
    for (let j = 0; j < dishViewCount; j++) {
      await prisma.statEvent.create({ data: { eventType: "DISH_VIEW", restaurantId: rest.id, dishId: pick(dishes).id, sessionId: s1.id, guestId: g.id } });
      totalEvents++;
    }

    // Impressions
    const impCount = rand(6, 15);
    await prisma.dishImpression.createMany({
      data: Array.from({ length: impCount }, (_, k) => ({ sessionId: s1.id, dishId: pick(dishes).id, restaurantId: rest.id, position: k, visibleMs: rand(500, 4000) })),
    });
    totalImpressions += impCount;

    // Searches
    if (Math.random() < 0.4) {
      const queries = [
        { query: "ceviche", results: 0 },
        { query: "sin gluten", results: 0 },
        { query: "vegano", results: 1 },
        { query: "paella", results: 0 },
        { query: "pollo", results: 2 },
      ];
      const sq = pick(queries);
      await prisma.statEvent.create({
        data: { eventType: "SEARCH_PERFORMED", restaurantId: rest.id, sessionId: s1.id, guestId: g.id, query: sq.query, resultsCount: sq.results, clickedResultId: sq.results > 0 && Math.random() < 0.3 ? pick(dishes).id : null },
      });
      totalEvents++;
    }

    // Genio
    if (hasGenio) {
      const gsId = `demo_genio_${i}_${NOW}`;
      await prisma.statEvent.create({ data: { eventType: "GENIO_START", restaurantId: rest.id, sessionId: s1.id, guestId: g.id, genioSessionId: gsId } });
      await prisma.statEvent.create({ data: { eventType: "GENIO_COMPLETE", restaurantId: rest.id, sessionId: s1.id, guestId: g.id, genioSessionId: gsId, dishId: pick(dishes).id } });
      await prisma.statEvent.create({ data: { eventType: "GENIO_DISH_ACCEPTED", restaurantId: rest.id, sessionId: s1.id, guestId: g.id, genioSessionId: gsId, dishId: pick(dishes).id } });
      totalEvents += 3;
    }

    // Second visit for first 20
    if (i < 20) {
      await prisma.guestProfile.update({ where: { id: g.id }, data: { visitCount: 2 } });
      const s2 = await prisma.session.create({
        data: {
          guestId: g.id, restaurantId: rest.id, deviceType: "mobile",
          startedAt: daysAgo(Math.max(0, g.createdDaysAgo - rand(2, 5))), durationMs: rand(40000, 250000),
          isReturningVisitor: true,
          dishesViewed: dishes.slice(0, rand(2, 4)).map((d: any) => ({ dishId: d.id, dwellMs: rand(1000, 5000) })),
        },
      });
      totalSessions++;
      for (let j = 0; j < rand(2, 4); j++) {
        await prisma.statEvent.create({ data: { eventType: "DISH_VIEW", restaurantId: rest.id, dishId: pick(dishes).id, sessionId: s2.id, guestId: g.id } });
        totalEvents++;
      }
    }

    // Third visit for first 8
    if (i < 8) {
      await prisma.guestProfile.update({ where: { id: g.id }, data: { visitCount: 3 } });
      const s3 = await prisma.session.create({
        data: { guestId: g.id, restaurantId: rest.id, deviceType: "mobile", startedAt: daysAgo(Math.max(0, g.createdDaysAgo - rand(5, 10))), durationMs: rand(50000, 200000), isReturningVisitor: true },
      });
      totalSessions++;
    }
  }

  // Specific failed searches
  const failedSearches = [
    { query: "ceviche", count: 8 }, { query: "sin gluten", count: 5 },
    { query: "vegano", count: 4 }, { query: "paella", count: 3 },
  ];
  for (const fs of failedSearches) {
    for (let i = 0; i < fs.count; i++) {
      const g = guests[rand(0, 49)];
      const sessions = await prisma.session.findMany({ where: { guestId: g.id }, take: 1 });
      if (sessions[0]) {
        await prisma.statEvent.create({
          data: { eventType: "SEARCH_PERFORMED", restaurantId: rest.id, sessionId: sessions[0].id, guestId: g.id, query: fs.query, resultsCount: 0 },
        });
        totalEvents++;
      }
    }
  }

  // Conversions (8 guests → QRUser)
  const conversionTriggers = [
    "post_genio_capture", "post_genio_capture", "post_genio_capture",
    "conversion_cta", "conversion_cta",
    "birthday_banner",
    "favorites_threshold", "favorites_threshold",
  ];
  const convertedUsers: { userId: string; guestId: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const g = guests[i];
    const user = await prisma.qRUser.create({ data: { email: `demo-${i}-${NOW}@test.quierocomer.cl`, name: `Demo User ${i}` } });
    await prisma.guestProfile.update({ where: { id: g.id }, data: { linkedQrUserId: user.id, convertedToUserAt: daysAgo(Math.max(0, g.createdDaysAgo - rand(2, 5))) } });
    await prisma.statEvent.updateMany({ where: { guestId: g.id, qrUserId: null }, data: { qrUserId: user.id } });
    await prisma.session.updateMany({ where: { guestId: g.id, qrUserId: null }, data: { qrUserId: user.id } });

    const sessions = await prisma.session.findMany({ where: { guestId: g.id }, take: 1 });
    if (sessions[0]) {
      await prisma.statEvent.create({
        data: { eventType: "USER_REGISTERED", restaurantId: rest.id, sessionId: sessions[0].id, guestId: g.id, qrUserId: user.id, metadata: { triggered_by: conversionTriggers[i], previous_guest_id: g.id } },
      });
      await prisma.session.update({ where: { id: sessions[0].id }, data: { converted: true } });
    }
    convertedUsers.push({ userId: user.id, guestId: g.id });
    totalEvents++;
  }

  // Favorites (~50 distributed)
  let totalFavs = 0;
  for (let i = 0; i < 30; i++) {
    const g = guests[i];
    const favCount = i < 5 ? 3 : i < 15 ? 2 : 1;
    const converted = convertedUsers.find((c) => c.guestId === g.id);
    for (let j = 0; j < favCount; j++) {
      try {
        await prisma.dishFavorite.create({
          data: {
            dishId: dishes[rand(0, dishes.length - 1)].id,
            restaurantId: rest.id,
            ...(converted ? { qrUserId: converted.userId } : { guestId: g.id }),
          },
        });
        totalFavs++;
      } catch {} // skip duplicate
    }
  }

  // Tickets (30)
  let matchExact = 0, matchProbable = 0, matchApprox = 0, matchNone = 0;
  for (let i = 0; i < 30; i++) {
    const dAgo = rand(0, 29);
    const paidAt = new Date(daysAgo(dAgo).getTime() + rand(0, 12) * 3600000);
    const hasMesa = Math.random() < 0.6;
    const mesaId = hasMesa ? `mesa_${rand(1, 3)}` : null;

    // Match logic
    const windowStart = new Date(paidAt.getTime() - 3 * 3600000);
    const windowEnd = new Date(paidAt.getTime() + 1800000);
    const candidates = await prisma.session.findMany({
      where: { restaurantId: rest.id, startedAt: { gte: windowStart, lte: windowEnd } },
      select: { id: true, startedAt: true }, orderBy: { startedAt: "desc" },
    });

    let matchedSessionId: string | null = null;
    let confidence = "none";
    if (candidates.length > 0) {
      const target = paidAt.getTime() - 1800000;
      candidates.sort((a, b) => Math.abs(a.startedAt.getTime() - target) - Math.abs(b.startedAt.getTime() - target));
      matchedSessionId = candidates[0].id;
      confidence = mesaId ? (candidates.length === 1 ? "exact" : "probable") : "approximate";
    }

    await prisma.restaurantTicket.create({
      data: { restaurantId: rest.id, mesaId, ticketTotal: rand(8000, 45000), ticketCountItems: rand(2, 8), paidAt, matchedSessionId, matchConfidence: confidence },
    });

    if (confidence === "exact") matchExact++;
    else if (confidence === "probable") matchProbable++;
    else if (confidence === "approximate") matchApprox++;
    else matchNone++;
  }

  // Verification
  const sessionCount = await prisma.session.count({ where: { restaurantId: rest.id } });
  const guestCount = await prisma.guestProfile.count({ where: { id: { startsWith: "demo_guest_" } } });
  const convCount = await prisma.statEvent.count({ where: { restaurantId: rest.id, eventType: "USER_REGISTERED" } });
  const favCount = await prisma.dishFavorite.count({ where: { restaurantId: rest.id } });
  const ticketCount = await prisma.restaurantTicket.count({ where: { restaurantId: rest.id } });

  console.log("\n=== SEED VERIFICATION ===");
  console.log(`✅ Demo Oasis creado (slug: ${SLUG})`);
  console.log(`✅ ${guestCount} GuestProfiles creados`);
  console.log(`✅ ${sessionCount} Sessions creadas`);
  console.log(`✅ ${convCount} conversiones registradas`);
  console.log(`✅ ~${favCount} DishFavorites`);
  console.log(`✅ ${ticketCount} RestaurantTickets (${matchExact} exact, ${matchProbable} probable, ${matchApprox} approximate, ${matchNone} none)`);
  console.log(`✅ ${totalImpressions} DishImpressions`);
  console.log(`✅ ${totalEvents} StatEvents`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("❌ FATAL:", e); process.exit(1); });
