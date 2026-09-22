import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";
import { fmtChile } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/shift → { ok, is_on_shift, shift_started_at } */
export async function GET(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
  const d = await prisma.driver.findUnique({ where: { id: driver.id }, select: { isOnShift: true, shiftStartedAt: true } });
  return NextResponse.json({ ok: true, is_on_shift: !!d?.isOnShift, shift_started_at: fmtChile(d?.shiftStartedAt ?? null) });
}

/** POST /api/driver/shift → alterna el turno. { ok, is_on_shift, shift_started_at } */
export async function POST(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
  const d = await prisma.driver.findUnique({ where: { id: driver.id }, select: { isOnShift: true } });
  const next = !d?.isOnShift;
  const startedAt = next ? new Date() : null;
  await prisma.driver.update({ where: { id: driver.id }, data: { isOnShift: next, shiftStartedAt: startedAt } });
  return NextResponse.json({ ok: true, is_on_shift: next, shift_started_at: fmtChile(startedAt) });
}
