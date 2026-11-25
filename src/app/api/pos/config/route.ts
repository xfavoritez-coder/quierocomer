import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess, demoSessionCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { getPanelId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Config del POS nativo SERVER-AUTHORITATIVE: mesas / sectores / garzones.
// Fuente de verdad = tablas Prisma PosTable/PosSector/PosStaff (reemplaza el
// event-sourcing en Dexie/pos_events que un wipe borraba). Mismo auth que la
// caja y que el board de mesas (assertOwnership) → sin regresión de permisos.

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = getPanelId(req);
  if (!panelId) return false;
  if (panelId === "demo") return demoSessionCanAccess(req, restaurantId);
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

// ── Mapeos DB (camelCase) → forma que ya usan los tipos del cliente (snake) ──
type DbTable = { id: string; restaurantId: string; number: number; label: string | null; sectorId: string | null; x: number; y: number; active: boolean };
type DbSector = { id: string; restaurantId: string; name: string; position: number };
type DbStaff = { id: string; restaurantId: string; name: string; pinHash: string; role: string; active: boolean };

const toClientTable = (t: DbTable) => ({ id: t.id, restaurant_id: t.restaurantId, number: t.number, label: t.label ?? undefined, sector_id: t.sectorId ?? undefined, x: t.x, y: t.y, active: t.active });
const toClientSector = (s: DbSector) => ({ id: s.id, restaurant_id: s.restaurantId, name: s.name, position: s.position });
const toClientStaff = (s: DbStaff) => ({ id: s.id, restaurant_id: s.restaurantId, name: s.name, pin_hash: s.pinHash, role: s.role, active: s.active });

// ── Lecturas del cuerpo (acepta forma snake del cliente) ──
interface InTable { id?: string; number?: number; label?: string; sector_id?: string | null; x?: number; y?: number; active?: boolean }
interface InSector { id?: string; name?: string; position?: number }
interface InStaff { id?: string; name?: string; role?: string; pin_hash?: string; active?: boolean }

function cuid(): string {
  // id simple y único para altas nuevas (en backfill se conserva el id de Dexie).
  return "pt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** GET /api/pos/config?restaurantId=X → { tables, sectors, staff } (forma cliente). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const [tables, sectors, staff] = await Promise.all([
    prisma.posTable.findMany({ where: { restaurantId }, orderBy: { number: "asc" } }),
    prisma.posSector.findMany({ where: { restaurantId }, orderBy: { position: "asc" } }),
    prisma.posStaff.findMany({ where: { restaurantId }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json(
    { tables: tables.map(toClientTable), sectors: sectors.map(toClientSector), staff: staff.map(toClientStaff) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/pos/config → { restaurantId, action, ... } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const restaurantId = String(body.restaurantId || "");
  const action = String(body.action || "");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  switch (action) {
    // ── Reemplaza el set completo de mesas (mismo modelo "set" del Dexie) ──
    // Conserva los ids entrantes (altas sin id → id nuevo). deleteMany+createMany
    // en transacción = el set queda EXACTAMENTE como lo mandó el cliente.
    case "tables.set": {
      const rows = Array.isArray(body.tables) ? (body.tables as InTable[]) : [];
      const data = rows.map((t) => ({
        id: String(t.id || cuid()),
        restaurantId,
        number: Math.round(Number(t.number) || 0),
        label: t.label ? String(t.label) : null,
        sectorId: t.sector_id ? String(t.sector_id) : null,
        x: Math.round(Number(t.x) || 0),
        y: Math.round(Number(t.y) || 0),
        active: t.active !== false,
      }));
      await prisma.$transaction([
        prisma.posTable.deleteMany({ where: { restaurantId } }),
        ...(data.length ? [prisma.posTable.createMany({ data })] : []),
      ]);
      const tables = await prisma.posTable.findMany({ where: { restaurantId }, orderBy: { number: "asc" } });
      return NextResponse.json({ tables: tables.map(toClientTable) });
    }

    // ── Reemplaza el set completo de sectores ──
    case "sectors.set": {
      const rows = Array.isArray(body.sectors) ? (body.sectors as InSector[]) : [];
      const data = rows.map((s, i) => ({
        id: String(s.id || cuid()),
        restaurantId,
        name: String(s.name || "").trim(),
        position: Number.isFinite(Number(s.position)) ? Math.round(Number(s.position)) : i,
      })).filter((s) => s.name);
      await prisma.$transaction([
        prisma.posSector.deleteMany({ where: { restaurantId } }),
        ...(data.length ? [prisma.posSector.createMany({ data })] : []),
      ]);
      const sectors = await prisma.posSector.findMany({ where: { restaurantId }, orderBy: { position: "asc" } });
      return NextResponse.json({ sectors: sectors.map(toClientSector) });
    }

    // ── Garzón: alta/upsert individual (lo que usa el panel de garzones) ──
    case "staff.add": {
      const s = (body.staff || {}) as InStaff;
      const name = String(s.name || "").trim();
      if (!name) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
      const id = String(s.id || cuid());
      const saved = await prisma.posStaff.upsert({
        where: { id },
        create: { id, restaurantId, name, role: String(s.role || "garzon"), pinHash: String(s.pin_hash || ""), active: s.active !== false },
        update: { name, role: String(s.role || "garzon"), active: s.active !== false },
      });
      return NextResponse.json({ staff: toClientStaff(saved as DbStaff) });
    }

    // ── Garzón: baja (hard delete; el garzón se guarda por NOMBRE en el pedido,
    //    así que borrar la fila no deja referencias huérfanas) ──
    case "staff.delete": {
      const staffId = String(body.staffId || "");
      if (!staffId) return NextResponse.json({ error: "Falta staffId" }, { status: 400 });
      await prisma.posStaff.deleteMany({ where: { id: staffId, restaurantId } });
      return NextResponse.json({ ok: true });
    }

    // ── Reemplaza el set completo de garzones (solo para el backfill inicial) ──
    case "staff.set": {
      const rows = Array.isArray(body.staff) ? (body.staff as InStaff[]) : [];
      const data = rows.map((s) => ({
        id: String(s.id || cuid()),
        restaurantId,
        name: String(s.name || "").trim(),
        role: String(s.role || "garzon"),
        pinHash: String(s.pin_hash || ""),
        active: s.active !== false,
      })).filter((s) => s.name);
      await prisma.$transaction([
        prisma.posStaff.deleteMany({ where: { restaurantId } }),
        ...(data.length ? [prisma.posStaff.createMany({ data })] : []),
      ]);
      const staff = await prisma.posStaff.findMany({ where: { restaurantId }, orderBy: { name: "asc" } });
      return NextResponse.json({ staff: staff.map(toClientStaff) });
    }

    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}
