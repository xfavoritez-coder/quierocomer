import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { chileDayRangeUtc, chileTodayYmd } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function safePct(num: number, den: number, decimals = 0): number {
  if (!den) return 0;
  const v = (num / den) * 100;
  return decimals === 1 ? round1(v) : Math.round(v);
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const today = chileTodayYmd();
  const fromYmd = req.nextUrl.searchParams.get("from") || today;
  const toYmd = req.nextUrl.searchParams.get("to") || fromYmd;
  const { start } = chileDayRangeUtc(fromYmd);
  const { end } = chileDayRangeUtc(toYmd);

  // All STORE_ events in date range (limit 5000)
  const events = await prisma.statEvent.findMany({
    where: {
      restaurantId,
      eventType: { in: ["STORE_VIEW", "STORE_DISH_VIEW", "STORE_CART_ADD", "STORE_CART_REMOVE", "STORE_CHECKOUT_START", "STORE_CHECKOUT_ABANDON", "STORE_ORDER_PLACED", "STORE_SEARCH", "STORE_CART_VIEW", "STORE_SESSION_END", "STORE_SCROLL_CATEGORY", "STORE_COUPON_ATTEMPT", "STORE_MODIFIER_OPEN"] as any[] },
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  // ── eventCounts ────────────────────────────────────────────────
  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
  }

  // ── funnel ─────────────────────────────────────────────────────
  const storeViews      = eventCounts["STORE_VIEW"]           || 0;
  const dishViews       = eventCounts["STORE_DISH_VIEW"]      || 0;
  const cartAdds        = eventCounts["STORE_CART_ADD"]       || 0;
  const checkoutStarts  = eventCounts["STORE_CHECKOUT_START"] || 0;
  const ordersPlaced    = eventCounts["STORE_ORDER_PLACED"]   || 0;
  const funnel = {
    storeViews, dishViews, cartAdds, checkoutStarts, ordersPlaced,
    browseRate:        safePct(dishViews,      storeViews),
    addRate:           safePct(cartAdds,       dishViews),
    checkoutRate:      safePct(checkoutStarts, cartAdds),
    orderRate:         safePct(ordersPlaced,   checkoutStarts),
    overallConversion: safePct(ordersPlaced,   storeViews, 1),
  };

  // ── dishes ─────────────────────────────────────────────────────
  interface DishAgg {
    dishId: string; dishName: string;
    views: number; cartAdds: number; modifierOpens: number;
    addedToCartViews: number;
    dwellSum: number; dwellCount: number;
  }
  const dishMap = new Map<string, DishAgg>();
  const getOrCreateDish = (id: string, name: string): DishAgg => {
    if (!dishMap.has(id)) dishMap.set(id, { dishId: id, dishName: name, views: 0, cartAdds: 0, modifierOpens: 0, addedToCartViews: 0, dwellSum: 0, dwellCount: 0 });
    return dishMap.get(id)!;
  };

  for (const e of events) {
    const m = e.metadata as Record<string, any> | null ?? {};
    const dId = String(m.dishId ?? e.dishId ?? "");
    const dName = String(m.dishName ?? "");
    if (!dId) continue;

    if (e.eventType === "STORE_DISH_VIEW") {
      const d = getOrCreateDish(dId, dName);
      d.views++;
      if (typeof m.dwellMs === "number") { d.dwellSum += m.dwellMs; d.dwellCount++; }
      if (m.addedToCart === true) d.addedToCartViews++;
    } else if (e.eventType === "STORE_CART_ADD") {
      const d = getOrCreateDish(dId, dName);
      d.cartAdds++;
    } else if (e.eventType === "STORE_MODIFIER_OPEN") {
      const d = getOrCreateDish(dId, dName);
      d.modifierOpens++;
    }
  }

  const dishes = Array.from(dishMap.values())
    .map((d) => ({
      dishId: d.dishId,
      dishName: d.dishName,
      views: d.views,
      avgDwellMs: d.dwellCount > 0 ? Math.round(d.dwellSum / d.dwellCount) : null,
      cartAdds: d.cartAdds,
      modifierOpens: d.modifierOpens,
      addedToCartViews: d.addedToCartViews,
      convRate: safePct(d.cartAdds, d.views),
    }))
    .sort((a, b) => b.views - a.views);

  // ── categories ────────────────────────────────────────────────
  interface CatAgg { categoryId: string; categoryName: string; scrolls: number; dwellSum: number; dwellCount: number }
  const catMap = new Map<string, CatAgg>();
  for (const e of events) {
    if (e.eventType !== "STORE_SCROLL_CATEGORY") continue;
    const m = e.metadata as Record<string, any> | null ?? {};
    const cId = String(m.categoryId ?? e.categoryId ?? "");
    const cName = String(m.categoryName ?? "");
    if (!cId) continue;
    if (!catMap.has(cId)) catMap.set(cId, { categoryId: cId, categoryName: cName, scrolls: 0, dwellSum: 0, dwellCount: 0 });
    const c = catMap.get(cId)!;
    c.scrolls++;
    if (typeof m.dwellMs === "number") { c.dwellSum += m.dwellMs; c.dwellCount++; }
  }
  const categories = Array.from(catMap.values())
    .map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      scrolls: c.scrolls,
      avgDwellMs: c.dwellCount > 0 ? Math.round(c.dwellSum / c.dwellCount) : null,
    }))
    .sort((a, b) => b.scrolls - a.scrolls);

  // ── sessions ──────────────────────────────────────────────────
  const sessionEndEvents = events.filter((e) => e.eventType === "STORE_SESSION_END");
  const sessTotal = sessionEndEvents.length;
  let sessDurSum = 0, sessDurCount = 0, sessDishSum = 0, sessDishCount = 0;
  let sessWithCart = 0, sessCartValueSum = 0;
  for (const e of sessionEndEvents) {
    const m = e.metadata as Record<string, any> | null ?? {};
    if (typeof m.sessionDurationMs === "number") { sessDurSum += m.sessionDurationMs; sessDurCount++; }
    if (typeof m.dishesViewed === "number") { sessDishSum += m.dishesViewed; sessDishCount++; }
    if (typeof m.cartValue === "number" && m.cartValue > 0) { sessWithCart++; sessCartValueSum += m.cartValue; }
  }
  const sessions = {
    total: sessTotal,
    avgDurationMs: sessDurCount > 0 ? Math.round(sessDurSum / sessDurCount) : null,
    avgDishesViewed: sessDishCount > 0 ? round1(sessDishSum / sessDishCount) : null,
    withCart: sessWithCart,
    avgCartValue: sessWithCart > 0 ? Math.round(sessCartValueSum / sessWithCart) : null,
  };

  // ── coupons ───────────────────────────────────────────────────
  const couponEvents = events.filter((e) => e.eventType === "STORE_COUPON_ATTEMPT");
  let couponSuccesses = 0, couponFailures = 0;
  const failedMap = new Map<string, { code: string; count: number; reason: string }>();
  for (const e of couponEvents) {
    const m = e.metadata as Record<string, any> | null ?? {};
    if (m.success === true) { couponSuccesses++; }
    else {
      couponFailures++;
      const code = String(m.code ?? "").toUpperCase();
      if (code) {
        const entry = failedMap.get(code) || { code, count: 0, reason: String(m.reason ?? "") };
        entry.count++;
        failedMap.set(code, entry);
      }
    }
  }
  const topFailed = Array.from(failedMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  const coupons = {
    total: couponEvents.length,
    successes: couponSuccesses,
    failures: couponFailures,
    successRate: safePct(couponSuccesses, couponEvents.length),
    topFailed,
  };

  // ── searches ──────────────────────────────────────────────────
  const searchMap = new Map<string, number>();
  for (const e of events) {
    if (e.eventType !== "STORE_SEARCH") continue;
    const m = e.metadata as Record<string, any> | null ?? {};
    const q = String(m.query ?? e.query ?? "").toLowerCase().trim();
    if (!q) continue;
    searchMap.set(q, (searchMap.get(q) || 0) + 1);
  }
  const searches = Array.from(searchMap.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ── abandonedCarts ────────────────────────────────────────────
  const abandonEvents = events
    .filter((e) => e.eventType === "STORE_CHECKOUT_ABANDON")
    .slice(0, 20)
    .map((e) => {
      const m = e.metadata as Record<string, any> | null ?? {};
      const cartItems = Array.isArray(m.cartItems) ? m.cartItems : [];
      const totalValue = cartItems.reduce((s: number, it: any) => {
        const price = Number(it?.price ?? 0);
        const qty = Number(it?.qty ?? it?.quantity ?? 1);
        return s + price * qty;
      }, 0);
      return { cartItems, totalValue, createdAt: e.createdAt.toISOString() };
    });

  // ── cartViews ─────────────────────────────────────────────────
  const cartViewEvents = events.filter((e) => e.eventType === "STORE_CART_VIEW");
  let cartValSum = 0, cartValCount = 0;
  for (const e of cartViewEvents) {
    const m = e.metadata as Record<string, any> | null ?? {};
    if (typeof m.cartValue === "number") { cartValSum += m.cartValue; cartValCount++; }
  }
  const cartViews = {
    total: cartViewEvents.length,
    avgCartValue: cartValCount > 0 ? Math.round(cartValSum / cartValCount) : null,
  };

  // ── interpretations ───────────────────────────────────────────
  interface Interpretation { type: "success" | "warning" | "insight" | "info"; title: string; body: string; metric?: string }
  const interpretations: Interpretation[] = [];

  for (const d of dishes) {
    if (d.views > 10 && d.convRate < 15) {
      interpretations.push({ type: "warning", title: "Plato muy visto pero poco comprado", body: `${d.dishName}: ${d.views} vistas, solo ${d.convRate}% conversión. Revisar precio, foto o descripción.` });
    }
    if (d.modifierOpens > 5 && d.cartAdds < d.modifierOpens * 0.4) {
      interpretations.push({ type: "warning", title: "Fricción en modificadores", body: `${d.dishName}: ${d.modifierOpens} abrieron modificadores pero solo ${d.cartAdds} compraron. El flujo de opciones puede estar confundiendo.` });
    }
    if (d.avgDwellMs !== null && d.avgDwellMs > 20000 && d.convRate < 20) {
      const secs = Math.round(d.avgDwellMs / 1000);
      interpretations.push({ type: "insight", title: "Alto interés, baja compra", body: `${d.dishName}: promedio ${secs}s viendo el plato. Considera ajustar precio o agregar reseñas.` });
    }
  }

  if (funnel.overallConversion < 2 && storeViews > 0) {
    interpretations.push({ type: "warning", title: "Conversión muy baja", body: `Solo el ${funnel.overallConversion}% de visitas al store resultan en pedido. El promedio saludable es 3-5%.`, metric: `${funnel.overallConversion}%` });
  }
  if (funnel.overallConversion >= 5) {
    interpretations.push({ type: "success", title: "Excelente conversión", body: `${funnel.overallConversion}% de los visitantes realizan un pedido. ¡Por encima del promedio!`, metric: `${funnel.overallConversion}%` });
  }
  if (coupons.failures > coupons.successes && coupons.total > 5) {
    interpretations.push({ type: "warning", title: "Alta tasa de cupones fallidos", body: `${coupons.failures} intentos fallidos de cupón vs ${coupons.successes} exitosos. Revisa si hay cupones expirados publicados.` });
  }
  if (sessions.withCart > sessions.total * 0.3 && ordersPlaced < sessions.withCart) {
    interpretations.push({ type: "insight", title: "Muchas sesiones terminan con carrito lleno", body: `${sessions.withCart} sesiones finalizaron con productos en el carrito sin comprar. Considera mostrar un mensaje de recuperación.` });
  }
  if (funnel.addRate < 10 && dishViews > 20) {
    interpretations.push({ type: "warning", title: "Poca conversión de vistas a carrito", body: `Solo ${funnel.addRate}% de las fichas de platos termina en 'Agregar'. Revisar CTAs, precios y fotos.`, metric: `${funnel.addRate}%` });
  }
  if (funnel.browseRate > 70) {
    interpretations.push({ type: "success", title: "Alta exploración del menú", body: `${funnel.browseRate}% de los visitantes exploran los platos. El catálogo está atrayendo atención.`, metric: `${funnel.browseRate}%` });
  }
  const totalSearchCount = searches.reduce((s, x) => s + x.count, 0);
  if (totalSearchCount > 10) {
    interpretations.push({ type: "insight", title: "Clientes buscan activamente", body: `${totalSearchCount} búsquedas realizadas. Asegúrate de que los platos populares tengan nombres descriptivos.`, metric: `${totalSearchCount}` });
  }
  const avgDwellAll = dishes.length > 0
    ? dishes.filter((d) => d.avgDwellMs !== null).reduce((s, d) => s + (d.avgDwellMs ?? 0), 0) / Math.max(1, dishes.filter((d) => d.avgDwellMs !== null).length)
    : 0;
  if (avgDwellAll > 30000 && dishes.some((d) => d.avgDwellMs !== null)) {
    interpretations.push({ type: "insight", title: "Alta consideración promedio", body: `Los clientes pasan ${Math.round(avgDwellAll / 1000)}s promedio mirando platos — señal de menú interesante.` });
  }

  // ── recentEvents ──────────────────────────────────────────────
  const recentEvents = events.slice(0, 50).map((e) => ({
    id: e.id,
    eventType: e.eventType,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
    guestId: e.guestId,
  }));

  return NextResponse.json({
    from: fromYmd, to: toYmd,
    eventCounts, funnel, dishes, categories, sessions,
    coupons, searches, abandonedCarts: abandonEvents,
    cartViews, interpretations, recentEvents,
  });
}
