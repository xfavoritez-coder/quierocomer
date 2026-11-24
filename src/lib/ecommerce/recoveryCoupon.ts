import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import type { Coupon } from "@/lib/ecommerce/coupons";
import { resolveBrandIds } from "@/lib/ecommerce/client-segmentation";

/** Nombre visible de una sucursal: branchName configurado o, si no hay, el nombre del local. */
export function branchDisplayName(r: { name: string; ecommerceStoreConfig: unknown }): string {
  return parseStoreConfig(r.ecommerceStoreConfig).branchName?.trim() || r.name;
}

export const isRecoveryCouponCode = (code: string) => code.toUpperCase().trim().startsWith("VUELVE-");

/** % que se prometió en el email del cupón (nunca el configurado hoy):
 *  1. guardado en el enrollment al enviar (contextJson.couponPercent);
 *  2. cupones enviados antes de guardarlo: se lee del asunto del email enviado
 *     ("…tenemos un 25% para ti…" / "REGALO: -25% OFF");
 *  3. último recurso (sin registro del email): la configuración actual. */
async function promisedPercent(e: { restaurantId: string; contextJson: unknown; emailLogId: string | null }): Promise<number> {
  const ctx = e.contextJson && typeof e.contextJson === "object" ? (e.contextJson as Record<string, unknown>) : {};
  const saved = Number(ctx.couponPercent);
  if (Number.isFinite(saved) && saved > 0 && saved <= 100) return saved;

  if (e.emailLogId) {
    const log = await prisma.emailLog.findUnique({ where: { id: e.emailLogId }, select: { subject: true } });
    const m = log?.subject?.match(/(\d{1,2})\s*%/);
    if (m) return Number(m[1]);
  }

  const home = await prisma.restaurant.findUnique({ where: { id: e.restaurantId }, select: { ecommerceStoreConfig: true } });
  return parseStoreConfig(home?.ecommerceStoreConfig).recovery.recoveryIncentive.couponPercent || 15;
}

type Result =
  | { ok: true; coupon: Pick<Coupon, "id" | "code" | "type" | "label" | "freeProductId" | "discountType" | "discountValue" | "maxDiscountAmount" | "discountIncludesDelivery"> }
  | { ok: false; error: string };

/** Valida un cupón de recuperación (VUELVE-*). Estos cupones viven en RecoveryEnrollment
 *  (no en el JSON de cupones del local), son de UN solo uso y valen en CUALQUIER
 *  sucursal de la marca que envió el email (no en otras marcas). Usado tanto al aplicar el cupón como al pagar (checkout). */
export async function validateRecoveryCoupon(rawCode: string, restaurantId: string): Promise<Result> {
  const code = rawCode.toUpperCase().trim();
  const enrollment = await prisma.recoveryEnrollment.findFirst({
    where: { couponCode: code, automation: "recovery_incentive" },
    select: { id: true, restaurantId: true, status: true, contextJson: true, emailLogId: true },
  });
  if (!enrollment) return { ok: false, error: "Cupón no encontrado" };

  if (enrollment.restaurantId !== restaurantId) {
    const brandIds = await resolveBrandIds(enrollment.restaurantId);
    if (!brandIds.includes(restaurantId)) return { ok: false, error: "Este cupón no es válido en esta tienda" };
  }

  // Un solo uso: se registra en EcommerceCouponUse al confirmar el pedido/pago con el
  // cupón. (Que el cliente haya vuelto a pedir SIN el cupón —status "converted"— no lo
  // invalida: nunca lo usó.)
  const used = await prisma.ecommerceCouponUse.count({ where: { couponCode: code } });
  if (used > 0) return { ok: false, error: "Este cupón ya fue utilizado" };

  const pct = await promisedPercent(enrollment);

  return {
    ok: true,
    coupon: {
      id: enrollment.id, code, type: "discount", label: `${pct}% de descuento`, freeProductId: null,
      discountType: "percent", discountValue: pct, maxDiscountAmount: null, discountIncludesDelivery: false,
    },
  };
}
