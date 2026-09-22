import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/poll-state?date= → { ok, date, signature } (detección barata de cambios). */
export async function GET(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  const date = (req.nextUrl.searchParams.get("date") || "").trim() || chileTodayYmd();
  const { start, end } = chileDayRangeUtc(date);
  const range = { gte: start, lte: end };
  const rid = driver.restaurantId;
  const sel = { id: true, opsStage: true, assignedDriverId: true, updatedAt: true, opsReadyForDeliveryAt: true, opsDispatchedAt: true, opsDeliveredAt: true } as const;

  const [available, mine, done] = await Promise.all([
    prisma.posOrder.findMany({ where: { restaurantId: rid, isDelivery: true, opsStage: "ready", assignedDriverId: null, uberDeliveryId: null, pyaShippingId: null, createdAt: range }, select: sel, orderBy: { id: "asc" } }),
    prisma.posOrder.findMany({ where: { restaurantId: rid, assignedDriverId: driver.id, opsStage: "out_for_delivery", createdAt: range }, select: sel, orderBy: { id: "asc" } }),
    prisma.posOrder.findMany({ where: { restaurantId: rid, assignedDriverId: driver.id, opsStage: "delivered", createdAt: range }, select: sel, orderBy: { id: "asc" } }),
  ]);

  const line = (p: string, r: (typeof available)[number]) => `${p}|${r.id}|${r.opsStage}|${r.assignedDriverId ?? ""}|${r.updatedAt.getTime()}`;
  const parts = [...available.map((r) => line("A", r)), ...mine.map((r) => line("M", r)), ...done.map((r) => line("D", r))];
  const signature = crypto.createHash("sha1").update(date + "||" + parts.join("||")).digest("hex");

  return NextResponse.json({ ok: true, date, signature });
}
