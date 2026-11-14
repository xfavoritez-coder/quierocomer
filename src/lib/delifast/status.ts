// Mapeo compartido estado Delifast → opsStage del POS (lo usan el webhook
// /api/pos/delivery-status y el worker /api/cron/delifast-tracking).
export const STAGE_ORDER: Record<string, number> = { preparing: 0, ready: 1, out_for_delivery: 2, delivered: 3 };

export function toOpsStage(estado?: string | null): string | null {
  const e = (estado || "").toLowerCase();
  // OJO: el WEBHOOK manda el estado en español ("Entregado", "En Camino"), pero el
  // SCRAPING (getDelifastTracking → viaje.status) lo devuelve en inglés/Uber
  // ("delivered", "dropoff", "en_route..."). Hay que reconocer ambos.
  if (/entregad|delivered|dropoff_?complete|completed/.test(e)) return "delivered";
  if (/camino|reparto|retirad|despach|ruta|dropoff|transit|en.?route/.test(e)) return "out_for_delivery";
  return null; // confirmada / asignado / en local / preparing / otros → no cambia opsStage
}
