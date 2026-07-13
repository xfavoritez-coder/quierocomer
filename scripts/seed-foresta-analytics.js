const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RESTAURANT_ID = 'cmppl2wb60001ju04r1ntpqe6';

const POPULAR_DISHES = [
  { id: 'cmppl2wk7000cju04hiovy3m6', w: 22 },   // Latte
  { id: 'cmppl2wkh000eju0454h891n9', w: 18 },   // Cappuccino
  { id: 'cmppl2xog006qju04u9o07brz', w: 15 },   // Brunch para DOS
  { id: 'cmppl2xpj006wju04y6sdd9pg', w: 14 },   // Desayuno clásico
  { id: 'cmppl2xlv006cju04uldsteux', w: 13 },   // Tostada Huevo Pochado
  { id: 'cmppl2xjn005yju04jubhdrvu', w: 12 },   // Croissant Jamón Queso — use from actual ID
  { id: 'cmppl2xju005yju04jubhdrvu', w: 12 },   // Croissant Jamón Queso
  { id: 'cmppl2x2v0030ju046fje1n7w', w: 11 },   // Brownie de Chocolate
  { id: 'cmppl2wo70014ju047a3mrvxl', w: 10 },   // Matcha Latte
  { id: 'cmppl2xn9006iju04f6qsyedb', w: 10 },   // Tostada Palta
  { id: 'cmppl2xdz004yju04nnupohu3', w: 9 },    // Pie de Limón
  { id: 'cmppl2xs9007aju04fjql2r00', w: 9 },    // Menú de almuerzo
  { id: 'cmppl2x1a002qju04jcirfjje', w: 8 },    // Matcha Blanco
  { id: 'cmppl2wle000kju04tav384q1', w: 8 },    // Flat White
  { id: 'cmppl2xk40060ju04fo7e5veo', w: 7 },    // Sandwich Alerce (Pollo)
  { id: 'cmppl2xcm004oju04zz9qrd6z', w: 7 },    // Rollo de Canela
  { id: 'cmppl2wjn0008ju0425bebz9e', w: 6 },    // Americano
  { id: 'cmppl2x77003sju04k2e1a6sw', w: 6 },    // Galletón Red Velvet
  { id: 'cmppl2xor006sju040m44b7qv', w: 6 },    // Brunch para UNO
  { id: 'cmppl2wq2001gju04mi25budn', w: 6 },    // Latte Frío
  { id: 'cmppl2wpl001eju04ru9kx38p', w: 5 },    // Iced Coffee
  { id: 'cmppl2x8u0044ju047zq33ndk', w: 5 },    // Carrot Cake relleno
  { id: 'cmppl2xsq007cju04kqyphaj8', w: 5 },    // Menú Almuerzo Completo
  { id: 'cmppl2xfe0058ju04h1fzxn6f', w: 4 },    // Reina de Corazones
  { id: 'cmppl2xp8006uju04niiwyjw5', w: 4 },    // Desayuno dulce (using category as placeholder)
  { id: 'cmppl2xpx006yju04dj7n462o', w: 4 },    // Desayuno dulce
];

function weightedPick(items) {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.w;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function uid() {
  return 'c' + Array.from({length: 24}, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('');
}

function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

const CAT_IDS = [
  'cmppl2wgv0004ju04dl3rbgbq',  // cafés
  'cmppl2xcw004qju04ats4p2ns',  // postres
  'cmppl2xlm006aju04qqwxvuzx',  // tostadas
  'cmppl2xjk005wju040hsbop4z',  // sandwiches
  'cmppl2xo7006oju0423joszme',  // brunch
  'cmppl2xp8006uju04niiwyjw5',  // desayunos
];

async function main() {
  // Clear existing data
  await prisma.statEvent.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  await prisma.session.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  await prisma.customer.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  console.log('Datos anteriores eliminados');

  const now = new Date();
  const sessions = [];
  const events = [];

  // Generate 35 days of data
  for (let daysAgo = 35; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dow = date.getDay(); // 0=sun, 6=sat
    const isWeekend = dow === 0 || dow === 6;

    const sessionCount = daysAgo === 0
      ? rnd(10, 22)
      : isWeekend
        ? rnd(62, 96)
        : rnd(30, 55);

    const peakHours = [10,10,10,11,11,11,12,12,15,15,16,16,17,17,9,13,14,18,19];

    for (let s = 0; s < sessionCount; s++) {
      const hour = daysAgo === 0
        ? rnd(9, Math.max(now.getHours(), 12))
        : peakHours[Math.floor(Math.random() * peakHours.length)];
      const minute = rnd(0, 59);
      const sessionDate = new Date(date);
      sessionDate.setHours(hour, minute, 0, 0);

      const isQr = Math.random() < 0.58;
      const isMobile = Math.random() < 0.84;
      const durationMs = rnd(40000, 420000);
      const guestId = uid();
      const dbSessionId = uid();
      const views = ['premium', 'lista', 'impact'];
      const view = views[Math.floor(Math.random() * views.length)];
      const tod = hour < 12 ? 'MORNING' : hour < 14 ? 'LUNCH' : hour < 17 ? 'AFTERNOON' : hour < 21 ? 'DINNER' : 'LATE';

      sessions.push({
        id: dbSessionId,
        guestId,
        restaurantId: RESTAURANT_ID,
        startedAt: sessionDate,
        endedAt: new Date(sessionDate.getTime() + durationMs),
        durationMs,
        viewUsed: view,
        timeOfDay: tod,
        deviceType: isMobile ? 'mobile' : 'desktop',
        isQrScan: isQr,
        isAbandoned: Math.random() < 0.18,
        isReturningVisitor: Math.random() < 0.28,
        converted: Math.random() < 0.14,
      });

      // SESSION_START
      events.push({
        restaurantId: RESTAURANT_ID,
        sessionId: guestId,
        dbSessionId,
        eventType: 'SESSION_START',
        createdAt: sessionDate,
        timeOfDay: tod,
        guestId,
      });

      // 2-7 dish views
      const dishViewCount = rnd(2, 7);
      for (let v = 0; v < dishViewCount; v++) {
        const dish = weightedPick(POPULAR_DISHES);
        const evTime = new Date(sessionDate.getTime() + rnd(5000, Math.max(durationMs - 10000, 10000)));
        events.push({
          restaurantId: RESTAURANT_ID,
          sessionId: guestId,
          dbSessionId,
          eventType: 'DISH_VIEW',
          dishId: dish.id,
          createdAt: evTime,
          timeOfDay: tod,
          guestId,
        });
        // 35% chance to open detail
        if (Math.random() < 0.35) {
          events.push({
            restaurantId: RESTAURANT_ID,
            sessionId: guestId,
            dbSessionId,
            eventType: 'DISH_SELECT',
            dishId: dish.id,
            createdAt: new Date(evTime.getTime() + rnd(1000, 6000)),
            timeOfDay: tod,
            guestId,
          });
        }
      }

      // 1-3 category views
      const catCount = rnd(1, 3);
      for (let c = 0; c < catCount; c++) {
        events.push({
          restaurantId: RESTAURANT_ID,
          sessionId: guestId,
          dbSessionId,
          eventType: 'CATEGORY_VIEW',
          categoryId: CAT_IDS[Math.floor(Math.random() * CAT_IDS.length)],
          createdAt: new Date(sessionDate.getTime() + rnd(2000, 25000)),
          timeOfDay: tod,
          guestId,
        });
      }

      // QR_SCAN for QR sessions
      if (isQr) {
        events.push({
          restaurantId: RESTAURANT_ID,
          sessionId: guestId,
          dbSessionId,
          eventType: 'QR_SCAN',
          createdAt: sessionDate,
          timeOfDay: tod,
          guestId,
        });
      }

      // Occasional WAITER_CALL (8%)
      if (Math.random() < 0.08) {
        events.push({
          restaurantId: RESTAURANT_ID,
          sessionId: guestId,
          dbSessionId,
          eventType: 'WAITER_CALL',
          createdAt: new Date(sessionDate.getTime() + rnd(30000, durationMs - 5000)),
          timeOfDay: tod,
          guestId,
        });
      }
    }
  }

  // Create GuestProfile records first (foreign key requirement)
  const guestProfiles = sessions.map(s => ({
    id: s.guestId,
    deviceType: s.deviceType,
    visitCount: 1,
    totalSessions: 1,
  }));
  for (let i = 0; i < guestProfiles.length; i += 500) {
    await prisma.guestProfile.createMany({ data: guestProfiles.slice(i, i + 500), skipDuplicates: true });
  }
  console.log('GuestProfiles creados:', guestProfiles.length);

  // Insert sessions in batches
  let sOk = 0;
  for (let i = 0; i < sessions.length; i += 200) {
    await prisma.session.createMany({ data: sessions.slice(i, i + 200), skipDuplicates: true });
    sOk += sessions.slice(i, i + 200).length;
  }
  console.log('Sesiones creadas:', sOk);

  // Insert events in batches
  let eOk = 0;
  for (let i = 0; i < events.length; i += 500) {
    await prisma.statEvent.createMany({ data: events.slice(i, i + 500), skipDuplicates: true });
    eOk += events.slice(i, i + 500).length;
  }
  console.log('Eventos creados:', eOk);

  // Create 10 realistic customers
  const customers = [
    { name: 'Valentina Castro', email: 'valentina.castro@gmail.com', birth: new Date(1994, 3, 12) },
    { name: 'Camila Morales', email: 'cmorales@hotmail.com', birth: new Date(1990, 7, 25) },
    { name: 'Sofía Herrera', email: 'soherrera@gmail.com', birth: new Date(1998, 1, 8) },
    { name: 'Martina Lagos', email: 'mlagos@gmail.com', birth: new Date(1992, 10, 30) },
    { name: 'Ignacio Fuentes', email: 'nacho.fuentes@gmail.com', birth: new Date(1988, 5, 17) },
    { name: 'Tomás Vidal', email: 'tvidal@outlook.com', birth: new Date(1995, 9, 4) },
    { name: 'Francisca Rojas', email: 'francirojas@gmail.com', birth: new Date(1999, 2, 22) },
    { name: 'Javiera Muñoz', email: 'javiera.munoz@gmail.com', birth: new Date(1991, 6, 14) },
    { name: 'Catalina Soto', email: 'cata.soto@gmail.com', birth: new Date(1996, 0, 3) },
    { name: 'Felipe Araya', email: 'faraya@gmail.com', birth: new Date(1987, 11, 19) },
  ];

  for (const c of customers) {
    await prisma.customer.create({
      data: {
        restaurantId: RESTAURANT_ID,
        name: c.name,
        email: c.email,
        birthDate: c.birth,
        isSubscribed: Math.random() < 0.65,
        cookieId: uid(),
        preferences: { likedTags: ['café', 'brunch', 'postres'][Math.floor(Math.random() * 3)] },
      },
    });
  }
  console.log('Clientes creados: 10');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
