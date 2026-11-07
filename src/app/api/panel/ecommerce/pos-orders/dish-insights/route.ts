import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { chileDayRangeUtc } from "@/lib/driver/serialize";

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

/**
 * GET /api/panel/ecommerce/pos-orders/dish-insights?restaurantId=X&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Cruza vistas de platos (StatEvent) con ventas POS para detectar oportunidades.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const fromYmd = req.nextUrl.searchParams.get("from") || today;
  const toYmd = req.nextUrl.searchParams.get("to") || fromYmd;
  const { start, end } = chileDayRangeUtc(fromYmd);
  const endRange = chileDayRangeUtc(toYmd).end;

  // Eventos de vista de platos (menú QR + tienda e-commerce)
  const viewEvents = await prisma.statEvent.findMany({
    where: {
      restaurantId,
      eventType: { in: ["STORE_DISH_VIEW", "DISH_VIEW", "DISH_SELECT"] },
      createdAt: { gte: start, lte: endRange },
    },
    select: { eventType: true, metadata: true, dishId: true },
  });

  const cartEvents = await prisma.statEvent.findMany({
    where: {
      restaurantId,
      eventType: "STORE_CART_ADD",
      createdAt: { gte: start, lte: endRange },
    },
    select: { metadata: true, dishId: true },
  });

  // Agrupar vistas por nombre de plato
  type DishView = { views: number; cartAdds: number; dwellSum: number; dwellCount: number };
  const viewMap = new Map<string, DishView>();

  for (const e of viewEvents) {
    const meta = (e.metadata && typeof e.metadata === "object" ? e.metadata : {}) as Record<string, any>;
    const name = (meta?.dishName || meta?.name || "").trim();
    if (!name) continue;
    const d = viewMap.get(name) || { views: 0, cartAdds: 0, dwellSum: 0, dwellCount: 0 };
    d.views++;
    if (typeof meta?.dwellMs === "number" && meta.dwellMs > 0) { d.dwellSum += meta.dwellMs; d.dwellCount++; }
    viewMap.set(name, d);
  }

  for (const e of cartEvents) {
    const meta = (e.metadata && typeof e.metadata === "object" ? e.metadata : {}) as Record<string, any>;
    const name = (meta?.dishName || meta?.name || "").trim();
    if (!name) continue;
    const d = viewMap.get(name);
    if (d) { d.cartAdds++; viewMap.set(name, d); }
  }

  const dishes = [...viewMap.entries()]
    .map(([name, d]) => ({
      name,
      views: d.views,
      cartAdds: d.cartAdds,
      avgDwellMs: d.dwellCount > 0 ? Math.round(d.dwellSum / d.dwellCount) : null,
    }))
    .filter(d => d.views >= 2)
    .sort((a, b) => b.views - a.views)
    .slice(0, 100);

  return NextResponse.json({ dishes, from: fromYmd, to: toYmd });
}
