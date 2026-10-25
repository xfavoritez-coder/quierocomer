import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";

/** Un tramo del recargo por usar repartidores externos: rango del costo del reparto y el recargo (CLP). */
export interface SurchargeTier { min: number; max: number; surcharge: number }

const KEY = "delivery_surcharge_tiers";

function clean(tiers: unknown): SurchargeTier[] {
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t) => ({
      min: Math.max(0, Math.round(Number((t as SurchargeTier)?.min) || 0)),
      max: Math.max(0, Math.round(Number((t as SurchargeTier)?.max) || 0)),
      surcharge: Math.max(0, Math.round(Number((t as SurchargeTier)?.surcharge) || 0)),
    }))
    .filter((t) => t.max >= t.min)
    .sort((a, b) => a.min - b.min);
}

export async function getSurchargeTiers(): Promise<SurchargeTier[]> {
  const raw = await getPlatformSetting(KEY);
  if (!raw) return [];
  try { return clean(JSON.parse(raw)); } catch { return []; }
}

export async function setSurchargeTiers(tiers: SurchargeTier[]): Promise<void> {
  await setPlatformSetting(KEY, JSON.stringify(clean(tiers)));
}

/** Recargo (CLP) para un costo de reparto dado, según los tramos. */
export function computeSurcharge(tiers: SurchargeTier[], baseCost: number): number {
  const cost = Math.round(baseCost || 0);
  if (!tiers.length || cost <= 0) return 0;
  const hit = tiers.find((t) => cost >= t.min && cost <= t.max);
  if (hit) return hit.surcharge;
  // Si el costo supera el último tramo, aplica el recargo del tramo más alto.
  const last = tiers[tiers.length - 1];
  if (cost > last.max) return last.surcharge;
  return 0;
}
