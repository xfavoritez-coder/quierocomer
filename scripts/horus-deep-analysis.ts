import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const restaurant = await p.restaurant.findFirst({ where: { slug: "horusvegan" }, select: { id: true, name: true } });
  if (!restaurant) { console.log("No encontrado"); return; }

  const today = new Date("2026-04-25T00:00:00Z");
  const tomorrow = new Date("2026-04-26T00:00:00Z");

  // ═══ 1. ALL SESSIONS TODAY ═══
  const sessions = await p.session.findMany({
    where: { restaurantId: restaurant.id, startedAt: { gte: today, lt: tomorrow } },
    include: {
      guest: { select: { id: true, visitCount: true, preferences: true, favoriteIngredients: true } },
      qrUser: { select: { id: true, name: true, email: true, dietType: true, birthDate: true, restrictions: true, dislikes: true, createdAt: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  console.log(`══════════════════════════════════════`);
  console.log(`  HORUS VEGAN — Análisis profundo`);
  console.log(`  ${sessions.length} sesiones hoy (25 abril)`);
  console.log(`══════════════════════════════════════\n`);

  // ═══ 2. ALL STAT EVENTS TODAY ═══
  const allEvents = await p.statEvent.findMany({
    where: {
      restaurantId: restaurant.id,
      createdAt: { gte: today, lt: tomorrow },
    },
    select: { eventType: true, guestId: true, genioSessionId: true, dishId: true, query: true, metadata: true, createdAt: true, dbSessionId: true },
    orderBy: { createdAt: "asc" },
  });

  // ═══ 3. GENIO ANALYSIS ═══
  const genioEvents = allEvents.filter(e => e.eventType.startsWith("GENIO_"));
  const searchEvents = allEvents.filter(e => e.eventType === "SEARCH_PERFORMED");
  const recEvents = allEvents.filter(e => e.eventType === "RECOMMENDATION_SHOWN" || e.eventType === "RECOMMENDATION_TAPPED");

  // Group genio by genioSessionId
  const genioSessions: Record<string, typeof genioEvents> = {};
  for (const e of genioEvents) {
    const key = e.genioSessionId || e.guestId;
    if (!genioSessions[key]) genioSessions[key] = [];
    genioSessions[key].push(e);
  }

  // Classify genio sessions
  let genioNew = 0, genioReturning = 0;
  const abandonReasons: string[] = [];

  console.log(`── GENIO: Detalle por sesión ──\n`);
  for (const [id, evts] of Object.entries(genioSessions)) {
    const guestId = evts[0].guestId;
    const session = sessions.find(s => s.guestId === guestId);
    const hasPrefs = session?.guest?.preferences && Object.keys(session.guest.preferences as any).length > 0;
    const hasDiet = session?.qrUser?.dietType || (typeof window === "undefined" && false);
    const isReturning = !!(session?.qrUser?.dietType || hasPrefs);

    const types = evts.map(e => e.eventType);
    const completed = types.includes("GENIO_COMPLETE");
    const time = evts[0].createdAt.toISOString().slice(11, 16);

    if (isReturning) genioReturning++; else genioNew++;

    // Check if this guest did a dislike search
    const guestSearches = searchEvents.filter(e =>
      e.guestId === guestId &&
      (e.metadata as any)?.context === "dislike_search" // only from dislike search, not carta search
    );

    const status = completed ? "✅ COMPLETÓ" : "❌ ABANDONÓ";
    const userType = isReturning ? "🔄 Returning" : "🆕 Nuevo";
    const lastStep = types[types.length - 1].replace("GENIO_", "");

    console.log(`${time} | ${status} | ${userType} | Pasos: ${types.map(t => t.replace("GENIO_", "")).join(" → ")}`);
    if (guestSearches.length > 0) {
      console.log(`       Buscó ingredientes: ${guestSearches.map(s => `"${s.query}"`).join(", ")}`);
    }
    if (!completed) {
      abandonReasons.push(`${userType === "🔄 Returning" ? "returning" : "new"}_at_${lastStep}`);
    }
    if (session?.qrUser) {
      console.log(`       Usuario: ${session.qrUser.name || session.qrUser.email} | Dieta: ${session.qrUser.dietType || "sin definir"} | Cumple: ${session.qrUser.birthDate ? "✓" : "✗"}`);
    }
    console.log();
  }

  // ═══ 4. SEARCH ANALYSIS ═══
  console.log(`── BÚSQUEDAS EN CARTA ──\n`);
  const cartaSearches = searchEvents.filter(e => !(e.metadata as any)?.context || (e.metadata as any)?.context !== "dislike_search");
  const dislikeSearches = searchEvents.filter(e => (e.metadata as any)?.context === "dislike_search");

  if (cartaSearches.length > 0) {
    const queries: Record<string, { count: number; results: number }> = {};
    for (const s of cartaSearches) {
      const q = (s.query || "").toLowerCase();
      if (!queries[q]) queries[q] = { count: 0, results: 0 };
      queries[q].count++;
      queries[q].results = (s as any).resultsCount || 0;
    }
    for (const [q, data] of Object.entries(queries).sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  "${q}" → ${data.count}x`);
    }
  } else {
    console.log("  Nadie buscó en la carta");
  }

  console.log(`\n── BÚSQUEDAS DE INGREDIENTES (Genio dislikes) ──\n`);
  if (dislikeSearches.length > 0) {
    const queries: Record<string, number> = {};
    for (const s of dislikeSearches) {
      const q = (s.query || "").toLowerCase();
      queries[q] = (queries[q] || 0) + 1;
    }
    for (const [q, count] of Object.entries(queries).sort((a, b) => b - a)) {
      console.log(`  "${q}" → ${count}x`);
    }
  } else {
    console.log("  Nadie buscó ingredientes");
  }

  // ═══ 5. PERSONALIZATION ═══
  console.log(`\n── PERSONALIZACIÓN "Para ti" ──\n`);
  const shownCount = recEvents.filter(e => e.eventType === "RECOMMENDATION_SHOWN").length;
  const tappedCount = recEvents.filter(e => e.eventType === "RECOMMENDATION_TAPPED").length;
  const uniqueGuests = new Set(recEvents.map(e => e.guestId));
  console.log(`  Sesiones con personalización: ${uniqueGuests.size}`);
  console.log(`  Recomendaciones mostradas: ${shownCount}`);
  console.log(`  Recomendaciones tocadas: ${tappedCount} (${shownCount > 0 ? Math.round(tappedCount / shownCount * 100) : 0}% CTR)`);

  // ═══ 6. FAVORITES ═══
  const favEvents = allEvents.filter(e => e.eventType === "DISH_FAVORITED");
  const unfavEvents = allEvents.filter(e => e.eventType === "DISH_UNFAVORITED");
  console.log(`\n── FAVORITOS ──\n`);
  console.log(`  Likes: ${favEvents.length} | Unlikes: ${unfavEvents.length}`);
  if (favEvents.length > 0) {
    const dishIds = [...new Set(favEvents.map(e => e.dishId).filter(Boolean))];
    const dishes = await p.dish.findMany({ where: { id: { in: dishIds as string[] } }, select: { id: true, name: true } });
    const dishMap = Object.fromEntries(dishes.map(d => [d.id, d.name]));
    const counts: Record<string, number> = {};
    for (const e of favEvents) { if (e.dishId) counts[e.dishId] = (counts[e.dishId] || 0) + 1; }
    console.log("  Platos más likeados:");
    for (const [id, count] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${dishMap[id] || id} → ${count} likes`);
    }
  }

  // ═══ 7. SESSION PATTERNS ═══
  console.log(`\n── PATRONES DE SESIÓN ──\n`);

  const durations = sessions.filter(s => s.durationMs).map(s => s.durationMs!);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : 0;
  const medianDuration = durations.length > 0 ? Math.round(durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)] / 1000) : 0;

  const views: Record<string, number> = {};
  for (const s of sessions) { if (s.viewUsed) views[s.viewUsed] = (views[s.viewUsed] || 0) + 1; }

  const devices: Record<string, number> = {};
  for (const s of sessions) { if (s.deviceType) devices[s.deviceType] = (devices[s.deviceType] || 0) + 1; }

  const qrScans = sessions.filter(s => s.isQrScan).length;
  const directLinks = sessions.filter(s => !s.isQrScan).length;
  const returning = sessions.filter(s => s.isReturningVisitor).length;
  const registered = sessions.filter(s => s.qrUser).length;
  const withBirthday = sessions.filter(s => s.qrUser?.birthDate).length;
  const withDishes = sessions.filter(s => (s.dishesViewed as any[])?.length > 0).length;
  const withPick = sessions.filter(s => s.pickedDishId).length;

  console.log(`  Duración promedio: ${avgDuration}s | Mediana: ${medianDuration}s`);
  console.log(`  Vistas: ${Object.entries(views).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  console.log(`  Dispositivos: ${Object.entries(devices).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  console.log(`  QR scan: ${qrScans} | Link directo: ${directLinks}`);
  console.log(`  Visitantes recurrentes: ${returning} (${Math.round(returning / sessions.length * 100)}%)`);
  console.log(`  Registrados: ${registered} | Con cumpleaños: ${withBirthday}`);
  console.log(`  Vieron platos: ${withDishes} | Eligieron plato: ${withPick}`);

  // ═══ 8. TIME DISTRIBUTION ═══
  console.log(`\n── DISTRIBUCIÓN POR HORA ──\n`);
  const byHour: Record<number, number> = {};
  for (const s of sessions) {
    const h = new Date(s.startedAt).getUTCHours();
    byHour[h] = (byHour[h] || 0) + 1;
  }
  for (const h of Object.keys(byHour).map(Number).sort((a, b) => a - b)) {
    const localH = (h - 4 + 24) % 24; // UTC to Chile
    const bar = "█".repeat(byHour[h]);
    console.log(`  ${String(localH).padStart(2, "0")}:00 ${bar} (${byHour[h]})`);
  }

  // ═══ 9. WAITER CALLS ═══
  const waiterCalls = await p.waiterCall.findMany({
    where: { restaurant: { id: restaurant.id }, calledAt: { gte: today, lt: tomorrow } },
    select: { tableName: true, calledAt: true, answeredAt: true },
  });
  console.log(`\n── LLAMADAS AL GARZÓN ──\n`);
  console.log(`  Total: ${waiterCalls.length}`);
  if (waiterCalls.length > 0) {
    const answered = waiterCalls.filter(w => w.answeredAt);
    console.log(`  Respondidas: ${answered.length}`);
    if (answered.length > 0) {
      const avgResponse = Math.round(answered.reduce((a, w) => a + (new Date(w.answeredAt!).getTime() - new Date(w.calledAt).getTime()), 0) / answered.length / 1000);
      console.log(`  Tiempo promedio de respuesta: ${avgResponse}s`);
    }
  }

  // ═══ 10. TOP DISHES VIEWED ═══
  console.log(`\n── TOP PLATOS MÁS VISTOS (por dwell time) ──\n`);
  const dishDwells: Record<string, { totalMs: number; views: number }> = {};
  for (const s of sessions) {
    const viewed = (s.dishesViewed as any[]) || [];
    for (const d of viewed) {
      if (!d.dishId) continue;
      if (!dishDwells[d.dishId]) dishDwells[d.dishId] = { totalMs: 0, views: 0 };
      dishDwells[d.dishId].totalMs += d.dwellMs || 0;
      dishDwells[d.dishId].views++;
    }
  }
  const topDishIds = Object.entries(dishDwells).sort((a, b) => b[1].totalMs - a[1].totalMs).slice(0, 10).map(([id]) => id);
  if (topDishIds.length > 0) {
    const topDishes = await p.dish.findMany({ where: { id: { in: topDishIds } }, select: { id: true, name: true, price: true } });
    const topMap = Object.fromEntries(topDishes.map(d => [d.id, d]));
    for (const id of topDishIds) {
      const dish = topMap[id];
      const data = dishDwells[id];
      console.log(`  ${dish?.name || id} ($${dish?.price?.toLocaleString("es-CL") || "?"}) → ${data.views} vistas, ${Math.round(data.totalMs / 1000)}s total`);
    }
  }

  // ═══ SUMMARY ═══
  console.log(`\n══════════════════════════════════════`);
  console.log(`  RESUMEN`);
  console.log(`══════════════════════════════════════`);
  console.log(`  Sesiones: ${sessions.length}`);
  console.log(`  Genio: ${Object.keys(genioSessions).length} abrieron, ${genioEvents.filter(e => e.eventType === "GENIO_COMPLETE").length} completaron`);
  console.log(`  Abandono Genio en START: ${abandonReasons.filter(r => r.includes("START")).length} (${genioNew} nuevos, ${genioReturning} returning)`);
  console.log(`  Cumpleaños registrados: ${withBirthday}`);
  console.log(`  Favoritos dados: ${favEvents.length}`);

  await p.$disconnect();
}
main();
