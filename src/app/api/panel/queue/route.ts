import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** Inicio del día en Chile, como instante UTC (la fila y la numeración se reinician por día). */
export function chileDayStartUtc(now: Date = new Date()): Date {
  const diffMs = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" })).getTime()
    - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const cl = new Date(now.getTime() + diffMs);
  cl.setUTCHours(0, 0, 0, 0);
  return new Date(cl.getTime() - diffMs);
}

const SEL = { id: true, number: true, name: true, phone: true, partySize: true, status: true, source: true, note: true, createdAt: true, calledAt: true } as const;

/** GET /api/panel/queue?restaurantId= → { enabled, entries: [hoy] } */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { queueEnabled: true, slug: true } });
  const entries = await prisma.queueEntry.findMany({
    where: { restaurantId, createdAt: { gte: chileDayStartUtc() } },
    orderBy: { number: "asc" },
    select: SEL,
  });
  return NextResponse.json({ enabled: !!r?.queueEnabled, slug: r?.slug ?? null, entries });
}

/** POST /api/panel/queue { restaurantId, name, phone, partySize?, note? } → agrega a la fila */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const restaurantId = (body?.restaurantId || "").toString();
  const name = (body?.name || "").toString().trim().slice(0, 80);
  const phone = (body?.phone || "").toString().trim().slice(0, 30);
  const partySize = Math.max(1, Math.min(50, Math.round(Number(body?.partySize) || 1)));
  const note = (body?.note || "").toString().trim().slice(0, 200) || null;
  if (!restaurantId || !name || !phone) return NextResponse.json({ error: "Nombre y teléfono requeridos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const last = await prisma.queueEntry.findFirst({
    where: { restaurantId, createdAt: { gte: chileDayStartUtc() } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (last?.number ?? 0) + 1;
  const entry = await prisma.queueEntry.create({
    data: { restaurantId, number, name, phone, partySize, note, source: "staff", status: "WAITING" },
    select: SEL,
  });
  return NextResponse.json({ ok: true, entry });
}

/** PATCH /api/panel/queue { id, status } → cambia el estado de una persona de la fila */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = (body?.id || "").toString();
  const status = (body?.status || "").toString();
  const VALID = ["WAITING", "NEAR", "CALLED", "DONE", "CANCELLED"];
  if (!id || !VALID.includes(status)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const existing = await prisma.queueEntry.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!(await assertOwnership(req, existing.restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const entry = await prisma.queueEntry.update({
    where: { id },
    data: { status, ...(status === "CALLED" ? { calledAt: new Date() } : {}) },
    select: SEL,
  });
  return NextResponse.json({ ok: true, entry });
}

/** PUT /api/panel/queue { restaurantId, enabled } → activa/desactiva la fila virtual */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const restaurantId = (body?.restaurantId || "").toString();
  const enabled = body?.enabled === true;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { queueEnabled: enabled } });
  return NextResponse.json({ ok: true, enabled });
}
