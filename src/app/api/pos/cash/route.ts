import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Caja / Turno SERVER-AUTHORITATIVE. El servidor es la única fuente de verdad
// (tablas PosShift / PosCashSession). Una sola abierta por local garantizada por
// índice único parcial (WHERE isOpen) + chequeo idempotente aquí.

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "P2002";
}

/** GET /api/pos/cash?restaurantId=X → estado actual { shift, caja }. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const [shift, caja] = await Promise.all([
    prisma.posShift.findFirst({ where: { restaurantId, isOpen: true }, orderBy: { openedAt: "desc" } }),
    prisma.posCashSession.findFirst({ where: { restaurantId, isOpen: true }, orderBy: { openedAt: "desc" } }),
  ]);
  return NextResponse.json({ shift, caja }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/pos/cash → { restaurantId, action, ... } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const restaurantId = String(body.restaurantId || "");
  const action = String(body.action || "");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const by = typeof body.openedBy === "string" ? body.openedBy : (typeof body.closedBy === "string" ? body.closedBy : null);

  switch (action) {
    // ── Abrir turno (idempotente: si hay uno abierto, lo devuelve) ──
    case "shift_open": {
      const existing = await prisma.posShift.findFirst({ where: { restaurantId, isOpen: true } });
      if (existing) return NextResponse.json({ shift: existing, already: true });
      try {
        const shift = await prisma.posShift.create({ data: { restaurantId, openedBy: by, isOpen: true } });
        return NextResponse.json({ shift });
      } catch (e) {
        if (isUniqueViolation(e)) {
          const shift = await prisma.posShift.findFirst({ where: { restaurantId, isOpen: true } });
          return NextResponse.json({ shift, already: true });
        }
        throw e;
      }
    }

    // ── Cerrar turno (requiere caja cerrada; resume cajas del turno) ──
    case "shift_close": {
      const shiftId = String(body.shiftId || "");
      const shift = shiftId
        ? await prisma.posShift.findUnique({ where: { id: shiftId } })
        : await prisma.posShift.findFirst({ where: { restaurantId, isOpen: true } });
      if (!shift || shift.restaurantId !== restaurantId) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
      if (!shift.isOpen) return NextResponse.json({ shift, already: true });
      const openCaja = await prisma.posCashSession.findFirst({ where: { restaurantId, isOpen: true } });
      if (openCaja) return NextResponse.json({ error: "Cierra la caja antes de cerrar el turno" }, { status: 409 });
      const cajas = await prisma.posCashSession.findMany({ where: { shiftId: shift.id }, select: { totalSales: true } });
      const totalSales = cajas.reduce((s, c) => s + (c.totalSales || 0), 0);
      const updated = await prisma.posShift.update({
        where: { id: shift.id },
        data: { isOpen: false, closedAt: new Date(), closedBy: by, cajaCount: cajas.length, totalSales, note: typeof body.note === "string" ? body.note : undefined },
      });
      return NextResponse.json({ shift: updated });
    }

    // ── Abrir caja (requiere turno abierto; idempotente) ──
    case "caja_open": {
      const existing = await prisma.posCashSession.findFirst({ where: { restaurantId, isOpen: true } });
      if (existing) return NextResponse.json({ caja: existing, already: true });
      const shift = await prisma.posShift.findFirst({ where: { restaurantId, isOpen: true } });
      if (!shift) return NextResponse.json({ error: "Abre el turno primero" }, { status: 409 });
      const initialAmount = Math.max(0, Math.round(Number(body.initialAmount) || 0));
      try {
        const caja = await prisma.posCashSession.create({ data: { restaurantId, shiftId: shift.id, initialAmount, openedBy: by, isOpen: true } });
        return NextResponse.json({ caja });
      } catch (e) {
        if (isUniqueViolation(e)) {
          const caja = await prisma.posCashSession.findFirst({ where: { restaurantId, isOpen: true } });
          return NextResponse.json({ caja, already: true });
        }
        throw e;
      }
    }

    // ── Cerrar caja (arqueo) ──
    case "caja_close": {
      const sessionId = String(body.sessionId || "");
      const caja = sessionId
        ? await prisma.posCashSession.findUnique({ where: { id: sessionId } })
        : await prisma.posCashSession.findFirst({ where: { restaurantId, isOpen: true } });
      if (!caja || caja.restaurantId !== restaurantId) return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 });
      if (!caja.isOpen) return NextResponse.json({ caja, already: true });
      const num = (v: unknown): number | null => (v == null ? null : Math.round(Number(v) || 0));
      const updated = await prisma.posCashSession.update({
        where: { id: caja.id },
        data: {
          isOpen: false,
          closedAt: new Date(),
          closedBy: by,
          countedAmounts: (body.countedAmounts as object) ?? undefined,
          expectedAmounts: (body.expectedAmounts as object) ?? undefined,
          difference: num(body.difference),
          totalSales: num(body.totalSales),
          totalTips: num(body.totalTips),
          closedAccounts: num(body.closedAccounts),
          note: typeof body.note === "string" ? body.note : undefined,
        },
      });
      return NextResponse.json({ caja: updated });
    }

    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}
