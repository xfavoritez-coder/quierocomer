import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const RESTAURANT_ID = 'cmppl2wb60001ju04r1ntpqe6';
const TODAY = new Date('2026-07-10T23:59:59Z');
const DAYS_BACK = 30;

const DISH_IDS = [
  'cmppl2x77003sju04k2e1a6sw',
  'cmppl2x02002kju04mdttktrl',
  'cmppl2xvs007qju04q5h83cz0',
  'cmppl2wpl001eju04ru9kx38p',
  'cmppl2wvq0022ju04em9e58bf',
  'cmppl2xju005yju04jubhdrvu',
  'cmppl2xfe0058ju04h1fzxn6f',
  'cmppl2wyr002eju04k3p2yp2z',
  'cmppl2x2v0030ju046fje1n7w',
  'cmppl2xog006qju04u9o07brz',
];

const SEARCH_QUERIES = [
  'brownie', 'café', 'tostada', 'jugo', 'ensalada',
  'sándwich', 'torta', 'té', 'croissant', 'quiche',
  'smoothie', 'avocado', 'granola', 'tiramisu', 'latte',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(options) {
  // options: [{value, weight}, ...]
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

function getSessionsForDay(date) {
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dow === 0 || dow === 6;
  return isWeekend ? rand(25, 40) : rand(10, 20);
}

function getRandomHour() {
  // Picos: 9-11am (morning coffee) y 15-17hs (once)
  const r = Math.random();
  if (r < 0.40) return rand(9, 11);   // morning peak
  if (r < 0.80) return rand(15, 17);  // once peak
  if (r < 0.90) return rand(12, 14);  // lunch
  return rand(18, 21);                // evening
}

function getTimeOfDay(hour) {
  if (hour >= 6 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 15) return 'LUNCH';
  if (hour >= 15 && hour < 20) return 'AFTERNOON';
  if (hour >= 20 && hour < 23) return 'DINNER';
  return 'LATE';
}

async function main() {
  // 1. Obtener categorías de La Foresta
  const categories = await prisma.category.findMany({
    where: { restaurantId: RESTAURANT_ID },
    select: { id: true },
    take: 10,
  });
  const categoryIds = categories.map(c => c.id);
  console.log(`Categorías encontradas: ${categoryIds.length}`);
  if (categoryIds.length === 0) {
    console.error('No se encontraron categorías para este restaurante.');
    process.exit(1);
  }

  // 2. Generar sesiones para los últimos 30 días
  const allSessions = [];
  const allGuestIds = [];

  for (let dayOffset = 0; dayOffset < DAYS_BACK; dayOffset++) {
    const date = new Date(TODAY);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    const sessionCount = getSessionsForDay(date);

    for (let i = 0; i < sessionCount; i++) {
      const hour = getRandomHour();
      const minute = rand(0, 59);
      const second = rand(0, 59);

      const startedAt = new Date(date);
      startedAt.setHours(hour, minute, second, 0);

      const durationMs = rand(45000, 420000);
      const endedAt = new Date(startedAt.getTime() + durationMs);

      const language = weightedPick([
        { value: 'es', weight: 90 },
        { value: 'en', weight: 8 },
        { value: 'pt', weight: 2 },
      ]);

      const weather = weightedPick([
        { value: 'CLEAR', weight: 60 },
        { value: 'CLOUDY', weight: 25 },
        { value: 'RAIN', weight: 15 },
      ]);

      const timeOfDay = getTimeOfDay(hour);

      const viewUsed = weightedPick([
        { value: 'lista', weight: 50 },
        { value: 'premium', weight: 35 },
        { value: 'impact', weight: 15 },
      ]);

      const deviceType = weightedPick([
        { value: 'mobile', weight: 80 },
        { value: 'desktop', weight: 15 },
        { value: 'tablet', weight: 5 },
      ]);

      const isAbandoned = Math.random() < 0.20;
      const converted = Math.random() < 0.30;
      const isReturningVisitor = Math.random() < 0.25;
      const isQrScan = Math.random() < 0.45;

      const dishesViewedCount = rand(2, 15);
      const categoriesViewedCount = rand(1, Math.min(8, categoryIds.length));

      // GuestProfile: usa un ID simple tipo "guest_<uuid>"
      const guestId = `guest_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      allGuestIds.push(guestId);

      const sessionId = randomUUID();

      allSessions.push({
        id: sessionId,
        guestId,
        restaurantId: RESTAURANT_ID,
        startedAt,
        endedAt,
        durationMs,
        viewUsed,
        weather,
        timeOfDay,
        dishesViewed: Array.from({ length: dishesViewedCount }, () => pick(DISH_IDS)),
        categoriesViewed: Array.from({ length: categoriesViewedCount }, () => pick(categoryIds)),
        isAbandoned,
        converted,
        isReturningVisitor,
        isQrScan,
        language,
        cartaLang: language,
        deviceType,
        isBot: false,
        searchesCount: 0,
      });
    }
  }

  console.log(`Sesiones a insertar: ${allSessions.length}`);

  // 3. Crear GuestProfiles primero (requeridos por FK)
  const CHUNK_SIZE_GUESTS = 100;
  let guestsInserted = 0;
  for (let i = 0; i < allGuestIds.length; i += CHUNK_SIZE_GUESTS) {
    const chunk = allGuestIds.slice(i, i + CHUNK_SIZE_GUESTS);
    const result = await prisma.guestProfile.createMany({
      data: chunk.map(id => ({
        id,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        visitCount: 1,
        totalSessions: 1,
      })),
      skipDuplicates: true,
    });
    guestsInserted += result.count;
  }
  console.log(`GuestProfiles insertados: ${guestsInserted}`);

  // 4. Insertar Sessions en batches de 50
  const CHUNK_SIZE_SESSIONS = 50;
  let sessionsInserted = 0;
  for (let i = 0; i < allSessions.length; i += CHUNK_SIZE_SESSIONS) {
    const chunk = allSessions.slice(i, i + CHUNK_SIZE_SESSIONS);
    const result = await prisma.session.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    sessionsInserted += result.count;
    if (i % 200 === 0) {
      process.stdout.write(`  Sessions: ${sessionsInserted}/${allSessions.length}\r`);
    }
  }
  console.log(`\nSessions insertados: ${sessionsInserted}`);

  // 5. Generar StatEvents (3-8 por sesión)
  const EVENT_TYPES = [
    { value: 'DISH_VIEW', weight: 40 },
    { value: 'DISH_SELECT', weight: 25 },
    { value: 'SEARCH_PERFORMED', weight: 10 },
    { value: 'CATEGORY_VIEW', weight: 15 },
    { value: 'DISH_FAVORITED', weight: 5 },
    { value: 'DISH_VIEW', weight: 5 }, // SHARE_CLICKED no existe, usar DISH_VIEW extra
  ];

  const allEvents = [];
  for (const session of allSessions) {
    const eventCount = rand(3, 8);
    for (let e = 0; e < eventCount; e++) {
      const eventType = weightedPick(EVENT_TYPES);
      const createdAt = new Date(
        session.startedAt.getTime() +
        rand(0, session.durationMs || 120000)
      );

      const event = {
        id: randomUUID(),
        restaurantId: RESTAURANT_ID,
        sessionId: session.id,
        guestId: session.guestId,
        eventType,
        weather: session.weather,
        timeOfDay: session.timeOfDay,
        createdAt,
        metadata: null,
        query: null,
      };

      if (eventType === 'DISH_VIEW' || eventType === 'DISH_SELECT' || eventType === 'DISH_FAVORITED') {
        event.dishId = pick(DISH_IDS);
      } else if (eventType === 'CATEGORY_VIEW') {
        event.categoryId = pick(categoryIds);
      } else if (eventType === 'SEARCH_PERFORMED') {
        const q = pick(SEARCH_QUERIES);
        event.query = q;
        event.metadata = { query: q };
        event.resultsCount = rand(0, 12);
      }

      allEvents.push(event);
    }
  }

  console.log(`StatEvents a insertar: ${allEvents.length}`);

  // 6. Insertar StatEvents en batches de 100
  const CHUNK_SIZE_EVENTS = 100;
  let eventsInserted = 0;
  for (let i = 0; i < allEvents.length; i += CHUNK_SIZE_EVENTS) {
    const chunk = allEvents.slice(i, i + CHUNK_SIZE_EVENTS);
    const result = await prisma.statEvent.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    eventsInserted += result.count;
    if (i % 500 === 0) {
      process.stdout.write(`  Events: ${eventsInserted}/${allEvents.length}\r`);
    }
  }
  console.log(`\nStatEvents insertados: ${eventsInserted}`);

  console.log('\n=== RESUMEN FINAL ===');
  console.log(`GuestProfiles: ${guestsInserted}`);
  console.log(`Sessions: ${sessionsInserted}`);
  console.log(`StatEvents: ${eventsInserted}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
