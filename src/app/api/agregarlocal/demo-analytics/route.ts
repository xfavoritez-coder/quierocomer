import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Returns fictional but realistic analytics data using the restaurant's real dishes */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: { contains: slug } },
    select: {
      id: true,
      name: true,
      categories: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          dishes: {
            where: { isActive: true },
            select: { id: true, name: true, photos: true, price: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!restaurant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const allDishes = restaurant.categories.flatMap(c => c.dishes);
  const rng = seedRandom(slug);

  // --- Visitor Metrics ---
  const totalVisitors = 180 + Math.floor(rng() * 120);
  const returningVisitors = Math.floor(totalVisitors * (0.22 + rng() * 0.15));
  const totalSessions = totalVisitors + Math.floor(returningVisitors * 0.6);
  const birthdaysSaved = Math.floor(totalVisitors * (0.04 + rng() * 0.03));

  const metrics = {
    totalVisitors,
    returningVisitors,
    returningPct: Math.round((returningVisitors / totalVisitors) * 100),
    totalSessions,
    avgDurationMs: (90 + Math.floor(rng() * 80)) * 1000,
    avgDishesViewed: +(3.5 + rng() * 4).toFixed(1),
    birthdaysSaved,
    birthdayPct: Math.round((birthdaysSaved / totalVisitors) * 100),
    avgVisitsPerGuest: +(1.2 + rng() * 0.5).toFixed(1),
    engagedVisitors: Math.floor(totalVisitors * 0.65),
    engagementPct: 65 + Math.floor(rng() * 15),
    genioUsers: Math.floor(totalVisitors * (0.15 + rng() * 0.1)),
    genioUsedPct: 15 + Math.floor(rng() * 10),
  };

  // --- Dishes data (using real dishes) ---
  const shuffled = [...allDishes].sort(() => rng() - 0.5);
  const mostViewed = shuffled.slice(0, Math.min(10, allDishes.length)).map((d, i) => ({
    name: d.name,
    photo: d.photos?.[0] || null,
    count: 45 - i * 4 + Math.floor(rng() * 8),
  }));
  mostViewed.sort((a, b) => b.count - a.count);

  const leastViewed = [...allDishes]
    .sort(() => rng() - 0.5)
    .slice(0, Math.min(5, allDishes.length))
    .map(d => ({
      name: d.name,
      photo: d.photos?.[0] || null,
      count: 1 + Math.floor(rng() * 4),
    }));

  const mostDetailed = shuffled.slice(0, Math.min(5, allDishes.length)).map(d => ({
    name: d.name,
    photo: d.photos?.[0] || null,
    count: `${8 + Math.floor(rng() * 20)}s`,
  }));

  const topCategories = restaurant.categories.slice(0, 5).map(c => ({
    name: c.name,
    count: 20 + Math.floor(rng() * 40),
  }));
  topCategories.sort((a, b) => b.count - a.count);

  const dishes = { mostViewed, leastViewed, mostDetailed, topCategories };

  // --- Time of day ---
  const timeSlots = [
    { key: "morning", label: "Mañana", hint: "8–12h" },
    { key: "lunch", label: "Almuerzo", hint: "12–15h" },
    { key: "afternoon", label: "Tarde", hint: "15–19h" },
    { key: "dinner", label: "Cena", hint: "19–23h" },
  ];
  const timeOfDay = timeSlots.map(s => ({
    ...s,
    count: s.key === "lunch" ? 55 + Math.floor(rng() * 30)
      : s.key === "dinner" ? 40 + Math.floor(rng() * 25)
      : s.key === "afternoon" ? 15 + Math.floor(rng() * 15)
      : 8 + Math.floor(rng() * 10),
  }));

  const clientes = {
    totalSessions,
    timeOfDay,
    dietProfile: {
      diets: [
        { label: "Sin preferencia", count: Math.floor(totalVisitors * 0.6) },
        { label: "Vegetariano", count: Math.floor(totalVisitors * 0.12) },
        { label: "Vegano", count: Math.floor(totalVisitors * 0.06) },
      ],
      restrictions: [
        { label: "Sin gluten", count: Math.floor(totalVisitors * 0.08) },
        { label: "Sin lactosa", count: Math.floor(totalVisitors * 0.05) },
      ],
    },
    acquisition: {
      devices: [
        { name: "mobile", count: Math.floor(totalVisitors * 0.82) },
        { name: "desktop", count: Math.floor(totalVisitors * 0.15) },
        { name: "tablet", count: Math.floor(totalVisitors * 0.03) },
      ],
    },
    languages: [
      { code: "es", count: Math.floor(totalVisitors * 0.85) },
      { code: "en", count: Math.floor(totalVisitors * 0.10) },
      { code: "pt", count: Math.floor(totalVisitors * 0.05) },
    ],
  };

  // --- Searches ---
  const searchTerms = ["vegano", "sin gluten", "postre", "ensalada", "cerveza"];
  const searches = searchTerms.slice(0, 3 + Math.floor(rng() * 2)).map(q => ({
    query: q,
    count: 3 + Math.floor(rng() * 12),
    uniqueVisitors: 2 + Math.floor(rng() * 8),
  }));
  searches.sort((a, b) => b.count - a.count);

  // --- Popular by hour ---
  const popularByHour = timeSlots.map(s => {
    const pick = allDishes[Math.floor(rng() * allDishes.length)];
    return {
      key: s.key,
      label: s.label,
      hint: s.hint,
      name: pick?.name || "—",
      photo: pick?.photos?.[0] || null,
      count: 8 + Math.floor(rng() * 20),
    };
  });

  // --- Funnel ---
  const funnel = {
    totalGhosts: totalVisitors,
    returnedGhosts: returningVisitors,
    returnedPct: metrics.returningPct,
    convertedUsers: Math.floor(returningVisitors * 0.35),
    convertedPct: 35 + Math.floor(rng() * 10),
    activatedUsers: Math.floor(returningVisitors * 0.15),
    activatedPct: 15 + Math.floor(rng() * 8),
  };

  return NextResponse.json({
    restaurantName: restaurant.name,
    totalDishes: allDishes.length,
    totalCategories: restaurant.categories.length,
    metrics,
    dishes,
    clientes,
    searches,
    popularByHour,
    funnel,
  });
}

/** Simple seeded PRNG for deterministic demo data */
function seedRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 0x7fffffff;
  };
}
