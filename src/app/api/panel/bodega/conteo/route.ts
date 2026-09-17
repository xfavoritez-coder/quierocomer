import { NextRequest, NextResponse } from "next/server";
import { prisma, runInTx } from "@/lib/prisma";
import { ensureOwnBodega } from "@/lib/bodega/provision";
import { aplicarEfecto } from "@/lib/bodega/movimientos";

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

const INSUMO_SELECT = {
  id: true, nombre: true, categoria: true, unidadBase: true,
  ultimoPrecio: true, rendimiento: true, precioConRendimiento: true, familia: true,
  stockActual: true, fotoUrl: true, esCritico: true, activo: true,
} as const;

const EPS = 1e-6;

/** POST /api/panel/bodega/conteo — conteo físico global.
 *  Body: { restaurantId, items: [{ insumoId, stockReal }] }
 *  Por cada insumo con diferencia genera un movimiento de ajuste (ingreso o
 *  retiro FIFO con motivo "ajuste", nota "Conteo físico"). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) return NextResponse.json({ error: "No hay insumos para contar" }, { status: 400 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  // Insumos válidos de la bodega (con su stock del sistema y último precio).
  const insumos = await prisma.insumo.findMany({ where: { bodegaId, activo: true }, select: { id: true, stockActual: true, ultimoPrecio: true } });
  const map = new Map(insumos.map((i) => [i.id, i]));

  let ajustes = 0, valorMerma = 0, valorSobrante = 0;
  const errores: { insumoId: string; error: string }[] = [];
  const insumosUpd: any[] = [];

  for (const raw of items) {
    const insumoId = String(raw?.insumoId || "");
    const stockReal = Number(raw?.stockReal);
    const info = map.get(insumoId);
    if (!info) continue; // insumo que no pertenece a la bodega → ignorar
    if (!Number.isFinite(stockReal) || stockReal < 0) continue; // sin conteo → no ajusta
    const diff = stockReal - info.stockActual;
    if (Math.abs(diff) < EPS) continue; // sin diferencia

    const tipo: "ingreso" | "retiro" = diff > 0 ? "ingreso" : "retiro";
    const cantidad = Math.abs(diff);

    // Precio para valorizar un sobrante (ingreso): último lote → último precio → 0.
    let precio: number | undefined;
    if (tipo === "ingreso") {
      const last = await prisma.insumoLote.findFirst({ where: { insumoId }, orderBy: { createdAt: "desc" }, select: { precioUnitario: true } });
      precio = last?.precioUnitario ?? (info.ultimoPrecio != null ? info.ultimoPrecio * 1.19 : 0);
    }

    try {
      const out = await runInTx(async (tx) => {
        const eff = await aplicarEfecto(tx, { insumoId, tipo, cantidad, precioConIva: precio, fecha: new Date() });
        await tx.movimientoInsumo.create({
          data: {
            insumoId, bodegaId, restaurantId, tipo,
            motivo: "ajuste",
            cantidad: eff.cantidadAplicada,
            costoUnitario: eff.costoUnitario,
            costoTotal: eff.costoTotal,
            nota: "Conteo físico",
            detalle: eff.detalle,
          },
        });
        const insumo = await tx.insumo.findUnique({ where: { id: insumoId }, select: INSUMO_SELECT });
        return { insumo, eff };
      });
      ajustes += 1;
      if (tipo === "retiro") valorMerma += out.eff.costoTotal;
      else valorSobrante += out.eff.costoTotal;
      insumosUpd.push(out.insumo);
    } catch (e: any) {
      errores.push({ insumoId, error: e?.message || "Error al ajustar" });
    }
  }

  return NextResponse.json({ ajustes, errores, insumos: insumosUpd, resumen: { ajustes, valorMerma, valorSobrante } });
}
