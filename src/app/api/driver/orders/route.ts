import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";
import { chileTodayYmd, chileDayRangeUtc, serializeOrder, dashboardStats } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/orders?date=YYYY-MM-DD → dashboard (available/mine/done). */
export async function GET(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  const date = (req.nextUrl.searchParams.get("date") || "").trim() || chileTodayYmd();
  const { start, end } = chileDayRangeUtc(date);
  const range = { gte: start, lte: end };
  const origin = req.nextUrl.origin;
  const rid = driver.restaurantId;
  const inc = { resends: true } as const;

  const [available, mine, done] = await Promise.all([
    prisma.posOrder.findMany({
      where: { restaurantId: rid, isDelivery: true, opsStage: "ready", assignedDriverId: null, uberDeliveryId: null, pyaShippingId: null, createdAt: range },
      include: inc, orderBy: [{ opsReadyForDeliveryAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.posOrder.findMany({
      where: { restaurantId: rid, assignedDriverId: driver.id, opsStage: "out_for_delivery", createdAt: range },
      include: inc, orderBy: [{ opsDispatchedAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.posOrder.findMany({
      where: { restaurantId: rid, assignedDriverId: driver.id, opsStage: "delivered", createdAt: range },
      include: inc, orderBy: { opsDeliveredAt: "desc" }, take: 50,
    }),
  ]);

  const availableJson = available.map((o) => serializeOrder(o, origin));
  const mineJson = mine.map((o) => serializeOrder(o, origin));
  const doneJson = done.map((o) => serializeOrder(o, origin));

  return NextResponse.json({
    ok: true,
    date,
    driver: driver.displayName,
    dashboard: dashboardStats(mineJson, doneJson),
    available: availableJson,
    mine: mineJson,
    done: doneJson,
  });
}
