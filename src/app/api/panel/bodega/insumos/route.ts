import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOwnBodega } from "@/lib/bodega/provision";
import { CATEGORIAS, UNIDADES } from "@/lib/bodega/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verifica que la sesión del panel sea dueña (o team member) del restaurante. */
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

/** GET /api/panel/bodega/insumos?restaurantId=X → insumos activos de la bodega del local. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaEnabled: true } });
  if (!r?.bodegaEnabled) return NextResponse.json({ error: "Bodega no habilitada" }, { status: 404 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  const insumos = await prisma.insumo.findMany({
    where: { bodegaId, activo: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    select: {
      id: true, nombre: true, categoria: true, unidadBase: true,
      ultimoPrecio: true, rendimiento: true, precioConRendimiento: true, familia: true,
      stockActual: true, fotoUrl: true, esCritico: true,
    },
  });

  // Valor y precio CON IVA a partir de los lotes FIFO (promedio ponderado del stock).
  const ids = insumos.map((i) => i.id);
  const lotes = ids.length
    ? await prisma.insumoLote.findMany({ where: { insumoId: { in: ids }, cantidadRestante: { gt: 0 } }, select: { insumoId: true, cantidadRestante: true, precioUnitario: true } })
    : [];
  const agg = new Map<string, { valor: number; qty: number }>();
  for (const l of lotes) {
    const a = agg.get(l.insumoId) || { valor: 0, qty: 0 };
    a.valor += l.cantidadRestante * l.precioUnitario;
    a.qty += l.cantidadRestante;
    agg.set(l.insumoId, a);
  }
  const enriched = insumos.map((i) => {
    const a = agg.get(i.id);
    const valorStock = a?.valor ?? 0;
    const precioConIva = i.stockActual > 0 && valorStock > 0 ? valorStock / i.stockActual : null;
    return { ...i, valorStock, precioConIva };
  });

  return NextResponse.json({ bodegaId, insumos: enriched });
}

/** POST /api/panel/bodega/insumos → crea un insumo en la bodega del local. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaEnabled: true } });
  if (!r?.bodegaEnabled) return NextResponse.json({ error: "Bodega no habilitada" }, { status: 404 });

  const nombre = (body?.nombre || "").toString().trim();
  const categoria = (body?.categoria || "").toString();
  const unidadBase = UNIDADES.includes((body?.unidadBase || "").toString()) ? (body.unidadBase as string) : "UN";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!CATEGORIAS.includes(categoria)) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });

  const precio = body?.ultimoPrecio === null || body?.ultimoPrecio === undefined || body?.ultimoPrecio === "" ? NaN : Number(body.ultimoPrecio);
  const rendimiento = body?.rendimiento === null || body?.rendimiento === undefined || body?.rendimiento === "" ? NaN : Number(body.rendimiento);
  if (!Number.isFinite(precio) || precio < 0) return NextResponse.json({ error: "El precio es obligatorio" }, { status: 400 });
  // Rendimiento en porcentaje (90 = 90%). Precio con rendimiento = precio / (rendimiento/100).
  if (!Number.isFinite(rendimiento) || rendimiento <= 0) return NextResponse.json({ error: "El rendimiento es obligatorio" }, { status: 400 });
  const precioConRendimiento = precio / (rendimiento / 100);

  const familia = typeof body?.familia === "string" && body.familia.trim() ? body.familia.trim().slice(0, 80) : null;
  const stock = Number(body?.stockInicial) || 0;
  const fotoUrl = typeof body?.fotoUrl === "string" && body.fotoUrl.trim() ? body.fotoUrl.trim() : null;

  const bodegaId = await ensureOwnBodega(restaurantId);
  try {
    const insumo = await prisma.insumo.create({
      data: {
        bodegaId,
        nombre,
        categoria: categoria as any,
        unidadBase: unidadBase as any,
        ultimoPrecio: precio,
        rendimiento,
        precioConRendimiento,
        familia,
        stockActual: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        fotoUrl,
        esCritico: body?.esCritico === true,
      },
      select: {
        id: true, nombre: true, categoria: true, unidadBase: true,
        ultimoPrecio: true, rendimiento: true, precioConRendimiento: true, familia: true,
        stockActual: true, fotoUrl: true, esCritico: true,
      },
    });
    return NextResponse.json({ insumo });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe un insumo con ese nombre en la bodega" }, { status: 409 });
    console.error("[panel/bodega/insumos POST]", e);
    return NextResponse.json({ error: "Error al crear el insumo" }, { status: 500 });
  }
}
