// Aplica y revierte los efectos de un movimiento de stock (ingreso/retiro)
// sobre el stock materializado y los lotes FIFO. `tx` es un cliente Prisma
// (idealmente dentro de una transacción).

type Tx = any;

const INSUMO_SELECT = {
  id: true, nombre: true, categoria: true, unidadBase: true,
  ultimoPrecio: true, rendimiento: true, precioConRendimiento: true, familia: true,
  stockActual: true, fotoUrl: true, esCritico: true,
} as const;

/** Recalcula stockActual = Σ cantidadRestante de los lotes del insumo (fuente de
 *  verdad única, a prueba de desincronización). Acepta campos extra (ej. ultimoPrecio).
 *  Devuelve el insumo actualizado (INSUMO_SELECT). */
export async function recomputeStock(tx: Tx, insumoId: string, extra: Record<string, any> = {}) {
  const agg = await tx.insumoLote.aggregate({ where: { insumoId }, _sum: { cantidadRestante: true } });
  const stock = agg._sum.cantidadRestante ?? 0;
  return tx.insumo.update({ where: { id: insumoId }, data: { stockActual: stock, ...extra }, select: INSUMO_SELECT });
}

export type EfectoResultado = {
  cantidadAplicada: number;
  costoUnitario: number | null;
  costoTotal: number;
  detalle: any;
};

/** Aplica un ingreso (crea lote) o un retiro (consume FIFO). Ajusta stock. */
export async function aplicarEfecto(
  tx: Tx,
  opts: { insumoId: string; tipo: "ingreso" | "retiro"; cantidad: number; precioConIva?: number; fecha?: Date }
): Promise<EfectoResultado> {
  const { insumoId, tipo, cantidad } = opts;

  if (tipo === "ingreso") {
    const precio = Number.isFinite(opts.precioConIva as number) ? (opts.precioConIva as number) : 0;
    const lote = await tx.insumoLote.create({
      data: { insumoId, fecha: opts.fecha ?? new Date(), precioUnitario: precio, cantidadInicial: cantidad, cantidadRestante: cantidad },
    });
    await recomputeStock(tx, insumoId);
    return { cantidadAplicada: cantidad, costoUnitario: precio, costoTotal: precio * cantidad, detalle: { loteId: lote.id } };
  }

  // Retiro: consume los lotes más antiguos primero (FIFO), guardando de dónde salió.
  const lotes = await tx.insumoLote.findMany({ where: { insumoId, cantidadRestante: { gt: 0 } }, orderBy: [{ fecha: "asc" }, { createdAt: "asc" }] });
  let restante = cantidad, costo = 0;
  const tomas: { loteId: string; cantidad: number; precioUnitario: number }[] = [];
  for (const l of lotes) {
    if (restante <= 0) break;
    const take = Math.min(l.cantidadRestante, restante);
    costo += take * l.precioUnitario;
    tomas.push({ loteId: l.id, cantidad: take, precioUnitario: l.precioUnitario });
    await tx.insumoLote.update({ where: { id: l.id }, data: { cantidadRestante: l.cantidadRestante - take } });
    restante -= take;
  }
  const consumido = cantidad - restante;
  await recomputeStock(tx, insumoId);
  return { cantidadAplicada: consumido, costoUnitario: consumido > 0 ? costo / consumido : null, costoTotal: costo, detalle: { tomas } };
}

/** Revierte un movimiento ya aplicado (para editar o eliminar). */
export async function revertirEfecto(
  tx: Tx,
  mov: { insumoId: string; tipo: string; cantidad: number; costoUnitario: number | null; detalle: any }
): Promise<void> {
  const det = mov.detalle || {};
  if (mov.tipo === "ingreso") {
    const loteId = det.loteId as string | undefined;
    if (loteId) {
      const lote = await tx.insumoLote.findUnique({ where: { id: loteId } });
      if (lote) {
        if (lote.cantidadRestante !== lote.cantidadInicial) {
          throw new Error("No se puede modificar: parte del stock de este ingreso ya se consumió.");
        }
        await tx.insumoLote.delete({ where: { id: loteId } });
      }
    }
    await recomputeStock(tx, mov.insumoId);
    return;
  }

  // Retiro: devuelve la cantidad a los lotes de los que salió.
  const tomas: { loteId: string; cantidad: number; precioUnitario?: number }[] = det.tomas || [];
  for (const t of tomas) {
    const lote = await tx.insumoLote.findUnique({ where: { id: t.loteId } });
    if (lote) {
      const nuevo = Math.min(lote.cantidadInicial, lote.cantidadRestante + t.cantidad);
      await tx.insumoLote.update({ where: { id: t.loteId }, data: { cantidadRestante: nuevo } });
    } else {
      // El lote original ya no existe: recrea uno con la cantidad devuelta.
      await tx.insumoLote.create({ data: { insumoId: mov.insumoId, fecha: new Date(), precioUnitario: t.precioUnitario ?? mov.costoUnitario ?? 0, cantidadInicial: t.cantidad, cantidadRestante: t.cantidad } });
    }
  }
  await recomputeStock(tx, mov.insumoId);
}
