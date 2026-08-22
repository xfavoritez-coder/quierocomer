// ═══════════════════════════════════════════════════════════
//  Cupones de descuento del Ecommerce (portado de Servio).
//  Se guardan en Restaurant.ecommerceCoupons (JSON). Los usos se
//  registran en la tabla EcommerceCouponUse para los límites.
// ═══════════════════════════════════════════════════════════

export type CouponType = "discount" | "product";
export type DiscountType = "fixed" | "percent";

// Códigos de día (Domingo primero, como Servio).
export const DAY_CODES = ["D", "L", "M", "Mi", "J", "V", "S"] as const;

export interface Coupon {
  id: string;
  code: string;
  label?: string | null;
  isEnabled: boolean;
  type: CouponType;
  discountType: DiscountType;
  discountValue: number; // $ si fixed, % si percent
  maxDiscountAmount?: number | null; // tope del descuento (opcional)
  startDate?: string | null; // "YYYY-MM-DD"
  endDate?: string | null;
  startTime?: string | null; // "HH:MM"
  endTime?: string | null;
  daysOfWeek: string[]; // subconjunto de DAY_CODES; vacío = todos
  appliesDelivery: boolean;
  appliesPickup: boolean;
  minOrderAmount?: number | null;
  maxUses?: number | null; // total
  maxUsesPerUser?: number | null;
  freeProductId?: string | null; // para type "product"
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseCoupons(raw: unknown): Coupon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const o = c as Record<string, unknown>;
      return {
        id: String(o.id ?? Math.random().toString(36).slice(2, 9)),
        code: String(o.code ?? "").toUpperCase().trim(),
        label: o.label ? String(o.label) : null,
        isEnabled: o.isEnabled !== false,
        type: o.type === "product" ? "product" : "discount",
        discountType: o.discountType === "percent" ? "percent" : "fixed",
        discountValue: Math.max(0, num(o.discountValue) ?? 0),
        maxDiscountAmount: num(o.maxDiscountAmount),
        startDate: o.startDate ? String(o.startDate) : null,
        endDate: o.endDate ? String(o.endDate) : null,
        startTime: o.startTime ? String(o.startTime) : null,
        endTime: o.endTime ? String(o.endTime) : null,
        daysOfWeek: Array.isArray(o.daysOfWeek) ? (o.daysOfWeek as unknown[]).map(String).filter((d) => (DAY_CODES as readonly string[]).includes(d)) : [],
        appliesDelivery: o.appliesDelivery !== false,
        appliesPickup: o.appliesPickup !== false,
        minOrderAmount: num(o.minOrderAmount),
        maxUses: num(o.maxUses),
        maxUsesPerUser: num(o.maxUsesPerUser),
        freeProductId: o.freeProductId ? String(o.freeProductId) : null,
      } as Coupon;
    })
    .filter((c) => c.code);
}

/** Fecha/hora actual en Santiago (para vigencias). */
export function nowInChile(): { dateStr: string; timeStr: string; dayCode: string } {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "America/Santiago" }); // "YYYY-MM-DD HH:MM:SS"
  const [datePart, timePart] = s.split(" ");
  const d = new Date(s.replace(" ", "T"));
  return { dateStr: datePart, timeStr: timePart.slice(0, 5), dayCode: DAY_CODES[d.getDay()] };
}

export interface CouponContext {
  subtotal: number;
  orderType: "DELIVERY" | "PICKUP";
}

/** Valida un cupón (sin contar usos — eso lo hace el servidor con la tabla). */
export function validateCoupon(c: Coupon, ctx: CouponContext): { valid: boolean; error?: string } {
  if (!c.isEnabled) return { valid: false, error: "Este cupón no está activo" };

  const { dateStr, timeStr, dayCode } = nowInChile();
  if (c.startDate && dateStr < c.startDate) return { valid: false, error: `Cupón válido desde ${c.startDate}` };
  if (c.endDate && dateStr > c.endDate) return { valid: false, error: "Este cupón ya expiró" };
  if (c.startTime && timeStr < c.startTime) return { valid: false, error: `Disponible desde las ${c.startTime}` };
  if (c.endTime && timeStr > c.endTime) return { valid: false, error: `Disponible hasta las ${c.endTime}` };
  if (c.daysOfWeek.length > 0 && !c.daysOfWeek.includes(dayCode)) return { valid: false, error: "Cupón no disponible hoy" };

  if (ctx.orderType === "DELIVERY" && !c.appliesDelivery) return { valid: false, error: "Cupón solo válido para retiro" };
  if (ctx.orderType === "PICKUP" && !c.appliesPickup) return { valid: false, error: "Cupón solo válido para delivery" };

  if (c.minOrderAmount && ctx.subtotal < c.minOrderAmount) return { valid: false, error: `Monto mínimo: $${c.minOrderAmount.toLocaleString("es-CL")}` };

  return { valid: true };
}

/** Descuento en pesos que aplica un cupón sobre el subtotal. */
export function computeDiscount(c: Coupon, subtotal: number): number {
  if (c.type !== "discount") return 0; // "product" → producto gratis, no descuenta $
  let d = c.discountType === "percent" ? Math.round((subtotal * c.discountValue) / 100) : c.discountValue;
  if (c.maxDiscountAmount) d = Math.min(d, c.maxDiscountAmount);
  return Math.max(0, Math.min(d, subtotal));
}
