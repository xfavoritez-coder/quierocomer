// ═══════════════════════════════════════════════════════════
//  Happy Hour — lógica pura (sin React) compartida por la carta
//  QR, la tienda ecommerce y el checkout. Decide si un happy hour
//  está activo AHORA (hora de Chile) y calcula el precio rebajado.
// ═══════════════════════════════════════════════════════════

export interface HappyHourRule {
  id: string;
  name?: string | null;
  days: number[]; // 0=Dom .. 6=Sáb
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  discountType: "FIXED_PRICE" | "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  categoryIds: string[];
  dishIds: string[];
  channels?: string[]; // "qr" | "ecommerce"; vacío/ausente = todos los canales
  bannerText?: string | null;
  bannerColor?: string | null;
  isActive: boolean;
}

/** ¿El happy hour aplica en este canal? Sin channels (vacío) = todos. */
export function appliesToChannel(hh: { channels?: string[] | null }, channel: "qr" | "ecommerce"): boolean {
  const ch = hh.channels;
  if (!ch || ch.length === 0) return true;
  return ch.includes(channel);
}

export function chileNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
}

function timeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Devuelve TODOS los happy hours activos AHORA (día + ventana horaria). */
export function activeHappyHours<T extends HappyHourRule>(hours: T[] | null | undefined, now: Date = chileNow()): T[] {
  if (!hours?.length) return [];
  const day = now.getDay();
  const time = timeStr(now);
  return hours.filter((hh) => hh.isActive && hh.days?.includes(day) && time >= hh.startTime && time < hh.endTime);
}

/** Devuelve el primer happy hour activo AHORA, o null (útil para el banner). */
export function findActiveHappyHour<T extends HappyHourRule>(hours: T[] | null | undefined, now: Date = chileNow()): T | null {
  return activeHappyHours(hours, now)[0] ?? null;
}

/**
 * Mejor (menor) precio de happy hour para un producto entre TODOS los happy
 * hours activos que lo afectan. null si ninguno aplica. Permite varios happy
 * hours simultáneos (p. ej. uno para postres y otro para hand rolls).
 */
export function bestHappyHourPrice(
  item: { id: string; categoryId: string; price: number },
  activeList: HappyHourRule[],
): number | null {
  let best: number | null = null;
  for (const hh of activeList) {
    const p = happyHourPriceFor(item, hh);
    if (p != null && (best == null || p < best)) best = p;
  }
  return best;
}

/**
 * Precio de happy hour para un producto, calculado sobre su precio REGULAR.
 * Devuelve el precio rebajado solo si el producto está afectado (por categoría
 * o por id) y el precio resultante es menor y positivo; si no, null.
 */
export function happyHourPriceFor(
  item: { id: string; categoryId: string; price: number },
  hh: HappyHourRule,
): number | null {
  const byCat = hh.categoryIds?.length ? hh.categoryIds.includes(item.categoryId) : false;
  const byDish = hh.dishIds?.length ? hh.dishIds.includes(item.id) : false;
  if (!byCat && !byDish) return null;
  const p = hh.discountType === "FIXED_PRICE"
    ? hh.discountValue
    : hh.discountType === "FIXED_AMOUNT"
      ? item.price - hh.discountValue
      : Math.round(item.price * (1 - hh.discountValue / 100));
  return p > 0 && p < item.price ? p : null;
}
