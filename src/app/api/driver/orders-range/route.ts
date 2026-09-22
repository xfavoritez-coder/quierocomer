import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";
import { chileTodayYmd, chileDayRangeUtc, serializeOrder, dashboardStats } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/orders-range?from=&to= → { ok, from, to, driver, summary, done } */
export async function GET(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  let from = (req.nextUrl.searchParams.get("from") || "").trim() || chileTodayYmd();
  let to = (req.nextUrl.searchParams.get("to") || "").trim() || chileTodayYmd();
  if (from > to) [from, to] = [to, from];
  const { start } = chileDayRangeUtc(from);
  const { end } = chileDayRangeUtc(to);
  const origin = req.nextUrl.origin;

  const done = await prisma.posOrder.findMany({
    where: { restaurantId: driver.restaurantId, assignedDriverId: driver.id, opsStage: "delivered", createdAt: { gte: start, lte: end } },
    include: { resends: true }, orderBy: { opsDeliveredAt: "desc" },
  });
  const doneJson = done.map((o) => serializeOrder(o, origin));
  const stats = dashboardStats([], doneJson);

  return NextResponse.json({
    ok: true, from, to, driver: driver.displayName,
    summary: { orders_count: stats.orders_count, sum_delivery_tip: stats.sum_delivery_tip, driver_pay: stats.driver_pay },
    done: doneJson,
  });
}
