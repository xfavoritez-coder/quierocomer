// ═══════════════════════════════════════════════════════════
//  Provisión y asignación de bodegas (pilar Bodega).
//  Cada local apunta a una Bodega (Restaurant.bodegaId). Por defecto tiene la
//  suya (1:1); dos locales del mismo dueño pueden compartir la misma bodega
//  = stock único compartido. La asignación la controla el superadmin.
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";

/** Borra una bodega si quedó huérfana (sin locales y sin insumos). Idempotente. */
async function cleanupOrphanBodega(bodegaId: string | null | undefined): Promise<void> {
  if (!bodegaId) return;
  const [locales, insumos] = await Promise.all([
    prisma.restaurant.count({ where: { bodegaId } }),
    prisma.insumo.count({ where: { bodegaId } }),
  ]);
  if (locales === 0 && insumos === 0) {
    await prisma.bodega.delete({ where: { id: bodegaId } }).catch(() => {});
  }
}

/** Garantiza que el local tenga una bodega (crea la propia si no tiene). Devuelve el bodegaId. */
export async function ensureOwnBodega(restaurantId: string): Promise<string> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, ownerId: true, bodegaId: true },
  });
  if (!r) throw new Error("Local no encontrado");
  if (r.bodegaId) return r.bodegaId;
  const bodega = await prisma.bodega.create({ data: { nombre: `Bodega ${r.name}`, ownerId: r.ownerId ?? null } });
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { bodegaId: bodega.id } });
  return bodega.id;
}

/** Da al local una bodega PROPIA nueva (se despega de una compartida). Limpia la anterior si queda huérfana. */
export async function makeOwnBodega(restaurantId: string): Promise<string> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, ownerId: true, bodegaId: true },
  });
  if (!r) throw new Error("Local no encontrado");
  const prev = r.bodegaId;
  const bodega = await prisma.bodega.create({ data: { nombre: `Bodega ${r.name}`, ownerId: r.ownerId ?? null } });
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { bodegaId: bodega.id } });
  await cleanupOrphanBodega(prev);
  return bodega.id;
}

/** Comparte: apunta `restaurantId` a la bodega del local `targetRestaurantId`.
 *  La asignación la controla el superadmin, así que puede unir locales de distinto
 *  dueño (p.ej. Hand Roll + Haruna). Provisiona la bodega del target si no la tuviera.
 *  Limpia la bodega anterior si queda huérfana. */
export async function shareBodegaWith(restaurantId: string, targetRestaurantId: string): Promise<string> {
  if (restaurantId === targetRestaurantId) return ensureOwnBodega(restaurantId);
  const [me, target] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, bodegaId: true } }),
    prisma.restaurant.findUnique({ where: { id: targetRestaurantId }, select: { id: true, bodegaId: true } }),
  ]);
  if (!me) throw new Error("Local no encontrado");
  if (!target) throw new Error("Local a compartir no encontrado");

  const targetBodegaId = await ensureOwnBodega(targetRestaurantId);
  const prev = me.bodegaId;
  if (prev === targetBodegaId) return targetBodegaId;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { bodegaId: targetBodegaId } });
  await cleanupOrphanBodega(prev);
  return targetBodegaId;
}
