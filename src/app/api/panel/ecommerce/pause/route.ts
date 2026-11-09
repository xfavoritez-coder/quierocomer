import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { parseHours, getOpenStatus, chileWallString, type Closure } from "@/lib/ecommerce/hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

const PAUSE_PREFIX = "pause_";

/** Cierre de pausa manual vigente ahora (si hay). */
function activePause(closures: Closure[], nowWall: string): Closure | null {
  return closures.find((c) => c.id.startsWith(PAUSE_PREFIX) && c.from <= nowWall && nowWall < c.to) || null;
}

/** GET → estado de pausa manual del ecommerce. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceHours: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const hours = parseHours(r.ecommerceHours);
  const pause = activePause(hours.closures || [], chileWallString());
  return NextResponse.json({ paused: !!pause, until: pause?.to ?? null, openNow: getOpenStatus(hours).open });
}

/** POST → cierra momentáneamente la web (o reabre).
 *  { restaurantId, minutes?: number, restOfDay?: boolean, reopen?: boolean } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceHours: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const hours = parseHours(r.ecommerceHours);

  // Siempre partimos quitando cualquier pausa manual previa (no toca los cierres
  // programados, que tienen otro id). Reabrir = solo quitarlas.
  const kept = (hours.closures || []).filter((c) => !c.id.startsWith(PAUSE_PREFIX));

  if (body?.reopen === true) {
    const next = { ...hours, closures: kept };
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceHours: next as unknown as object } });
    return NextResponse.json({ ok: true, paused: false, until: null });
  }

  const now = new Date();
  const fromWall = chileWallString(now);
  let toWall: string;
  if (body?.restOfDay === true) {
    toWall = `${fromWall.slice(0, 10)}T23:59`;
  } else {
    const minutes = Math.min(Math.max(Number(body?.minutes) || 0, 1), 24 * 60);
    toWall = chileWallString(new Date(now.getTime() + minutes * 60_000));
  }
  if (toWall <= fromWall) return NextResponse.json({ error: "Rango inválido" }, { status: 400 });

  const pause: Closure = {
    id: `${PAUSE_PREFIX}${Date.now().toString(36)}`,
    from: fromWall,
    to: toWall,
    reason: "Cerrado temporalmente",
    affectsDelivery: true,
    affectsPickup: true,
  };
  const next = { ...hours, closures: [...kept, pause] };
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceHours: next as unknown as object } });
  return NextResponse.json({ ok: true, paused: true, until: toWall });
}
