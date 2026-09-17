import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOwnBodega } from "@/lib/bodega/provision";

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

/** GET /api/panel/bodega/familias?restaurantId=X
 *  Familias (con suma de stock y su configuración) + proveedores. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  const [insumos, configs, proveedores] = await Promise.all([
    prisma.insumo.findMany({ where: { bodegaId, activo: true, familia: { not: null } }, select: { familia: true, stockActual: true, unidadBase: true } }),
    prisma.familiaConfig.findMany({ where: { bodegaId }, select: { familia: true, stockMinimo: true, cantidadSolicitar: true, proveedorId: true, proveedor: { select: { nombre: true } } } }),
    prisma.proveedor.findMany({ where: { bodegaId, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  const agg = new Map<string, { sumStock: number; insumos: number; unidad: string }>();
  for (const i of insumos) {
    const fam = (i.familia || "").trim();
    if (!fam) continue;
    const a = agg.get(fam) || { sumStock: 0, insumos: 0, unidad: i.unidadBase };
    a.sumStock += i.stockActual; a.insumos += 1;
    agg.set(fam, a);
  }
  const cfgMap = new Map(configs.map((c) => [c.familia, c]));
  // También incluir familias que tienen config pero ya no tienen insumos (por si acaso).
  for (const c of configs) if (!agg.has(c.familia)) agg.set(c.familia, { sumStock: 0, insumos: 0, unidad: "UN" });

  const familias = Array.from(agg.entries()).map(([familia, a]) => {
    const c = cfgMap.get(familia);
    return {
      familia,
      sumStock: a.sumStock,
      insumos: a.insumos,
      unidad: a.unidad,
      config: c ? { stockMinimo: c.stockMinimo, cantidadSolicitar: c.cantidadSolicitar, proveedorId: c.proveedorId, proveedorNombre: c.proveedor?.nombre ?? null } : null,
    };
  }).sort((x, y) => x.familia.localeCompare(y.familia));

  return NextResponse.json({ familias, proveedores });
}

/** PUT /api/panel/bodega/familias → crea/actualiza la config de una familia. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const familia = (body?.familia || "").toString().trim();
  if (!familia) return NextResponse.json({ error: "Falta la familia" }, { status: 400 });
  const stockMinimo = Math.max(0, Number(body?.stockMinimo) || 0);
  const cantidadSolicitar = Math.max(0, Number(body?.cantidadSolicitar) || 0);
  const proveedorId = body?.proveedorId ? String(body.proveedorId) : null;

  const bodegaId = await ensureOwnBodega(restaurantId);
  if (proveedorId) {
    const prov = await prisma.proveedor.findUnique({ where: { id: proveedorId }, select: { bodegaId: true } });
    if (!prov || prov.bodegaId !== bodegaId) return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
  }

  const cfg = await prisma.familiaConfig.upsert({
    where: { bodegaId_familia: { bodegaId, familia } },
    create: { bodegaId, familia, stockMinimo, cantidadSolicitar, proveedorId },
    update: { stockMinimo, cantidadSolicitar, proveedorId },
    select: { familia: true, stockMinimo: true, cantidadSolicitar: true, proveedorId: true, proveedor: { select: { nombre: true } } },
  });
  return NextResponse.json({ config: { familia: cfg.familia, stockMinimo: cfg.stockMinimo, cantidadSolicitar: cfg.cantidadSolicitar, proveedorId: cfg.proveedorId, proveedorNombre: cfg.proveedor?.nombre ?? null } });
}
