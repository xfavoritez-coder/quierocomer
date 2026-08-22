// ═══════════════════════════════════════════════════════════
//  Zonas de delivery del Ecommerce.
//  Cada local se autoadministra sus zonas (comuna/sector + tarifa).
//  Se guardan en Restaurant.ecommerceDeliveryZones (JSON).
// ═══════════════════════════════════════════════════════════

export interface DeliveryZone {
  id: string;
  name: string; // comuna o nombre del sector
  fee: number; // costo de despacho en CLP
  minOrder?: number | null; // pedido mínimo para esa zona (opcional)
  estimatedTime?: string | null; // ej: "30-45 min" (opcional)
  active: boolean;
}

/** Normaliza el JSON crudo a un arreglo de zonas seguro. */
export function parseDeliveryZones(raw: unknown): DeliveryZone[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((z) => z && typeof z === "object")
    .map((z) => {
      const o = z as Record<string, unknown>;
      return {
        id: String(o.id ?? cryptoId()),
        name: String(o.name ?? "").trim(),
        fee: Math.max(0, Math.round(Number(o.fee) || 0)),
        minOrder: o.minOrder == null || o.minOrder === "" ? null : Math.max(0, Math.round(Number(o.minOrder) || 0)),
        estimatedTime: o.estimatedTime ? String(o.estimatedTime) : null,
        active: o.active !== false,
      } as DeliveryZone;
    })
    .filter((z) => z.name.length > 0);
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10);
}
