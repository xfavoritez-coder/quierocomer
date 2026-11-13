// Mapeo compartido estado Delifast → opsStage del POS (lo usan el webhook
// /api/pos/delivery-status y el worker /api/cron/delifast-tracking).
export const STAGE_ORDER: Record<string, number> = { preparing: 0, ready: 1, out_for_delivery: 2, delivered: 3 };

export function toOpsStage(estado?: string | null): string | null {
  const e = (estado || "").toLowerCase();
  if (/entregad/.test(e)) return "delivered";
  if (/camino|reparto|retirad|despach|ruta/.test(e)) return "out_for_delivery";
  return null; // confirmada / asignado / en local / otros → no cambia opsStage
}
