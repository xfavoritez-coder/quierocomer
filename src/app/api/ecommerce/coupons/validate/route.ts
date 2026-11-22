import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCoupons, validateCoupon, computeDiscount } from "@/lib/ecommerce/coupons";

export const runtime = "nodejs";

/**
 * POST /api/ecommerce/coupons/validate
 * Body: { restaurantSlug|restaurantId, code, subtotal, orderType, phone? }
 * Valida el cupón (vigencia, aplicabilidad, mínimo, usos) y devuelve el descuento.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantSlug, restaurantId, code, subtotal, deliveryFee, orderType, phone, fromApp } = body as {
      restaurantSlug?: string; restaurantId?: string; code?: string; subtotal?: number; deliveryFee?: number; orderType?: string; phone?: string; fromApp?: boolean;
    };
    if ((!restaurantSlug && !restaurantId) || !code) return NextResponse.json({ valid: false, error: "Datos incompletos" });

    const restaurant = await (restaurantId
      ? prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, ecommerceEnabled: true, ecommerceCoupons: true } })
      : prisma.restaurant.findUnique({ where: { slug: restaurantSlug! }, select: { id: true, ecommerceEnabled: true, ecommerceCoupons: true } }));
    if (!restaurant || !restaurant.ecommerceEnabled) return NextResponse.json({ valid: false, error: "Tienda no disponible" });

    const normalCode = String(code).toUpperCase().trim();
    const coupon = parseCoupons(restaurant.ecommerceCoupons).find((c) => c.code === normalCode);

    // Fallback: cupones de recuperación (VUELVE-*) viven en RecoveryEnrollment, no en el JSON
    if (!coupon && normalCode.startsWith("VUELVE-")) {
      try {
        const enrollment = await prisma.recoveryEnrollment.findFirst({
          where: { couponCode: normalCode, automation: "recovery_incentive", status: { not: "converted" } },
          select: { id: true, couponCode: true, restaurantId: true, customerEmail: true, contextJson: true },
        });
        if (!enrollment) return NextResponse.json({ valid: false, error: "Cupón no encontrado o ya utilizado" });
        // Buscar config del % de descuento
        const restConfig = await prisma.restaurant.findUnique({ where: { id: enrollment.restaurantId }, select: { ecommerceStoreConfig: true } });
        const cfg = restConfig?.ecommerceStoreConfig as Record<string, unknown> | null;
        const recovery = (cfg?.recovery && typeof cfg.recovery === "object") ? cfg.recovery as Record<string, unknown> : {};
        const incentive = (recovery.recoveryIncentive && typeof recovery.recoveryIncentive === "object") ? recovery.recoveryIncentive as Record<string, unknown> : {};
        const pct = Number(incentive.couponPercent) || 15;
        // Verificar si ya fue usado
        const used = await prisma.ecommerceCouponUse.count({ where: { restaurantId: restaurant.id, couponCode: normalCode } });
        if (used > 0) return NextResponse.json({ valid: false, error: "Este cupón ya fue utilizado" });
        const discount = Math.round((Number(subtotal) || 0) * pct / 100);
        return NextResponse.json({
          valid: true, discount,
          coupon: {
            id: enrollment.id, code: normalCode, type: "discount" as const, label: `${pct}% de descuento`,
            freeProductId: null, discountType: "percent" as const, discountValue: pct,
            maxDiscountAmount: null, discountIncludesDelivery: false,
          },
        });
      } catch { /* fall through to not found */ }
    }

    if (!coupon) return NextResponse.json({ valid: false, error: "Cupón no encontrado" });

    const oType = orderType === "DELIVERY" ? "DELIVERY" : "PICKUP";
    const base = validateCoupon(coupon, { subtotal: Number(subtotal) || 0, orderType: oType, fromApp: fromApp === true });
    if (!base.valid) return NextResponse.json({ valid: false, error: base.error });

    // Usos totales
    if (coupon.maxUses) {
      const used = await prisma.ecommerceCouponUse.count({ where: { restaurantId: restaurant.id, couponCode: coupon.code } });
      if (used >= coupon.maxUses) return NextResponse.json({ valid: false, error: "Este cupón ya llegó al límite de usos" });
    }
    // Usos por usuario (por teléfono)
    if (coupon.maxUsesPerUser && phone) {
      const usedByUser = await prisma.ecommerceCouponUse.count({ where: { restaurantId: restaurant.id, couponCode: coupon.code, customerPhone: phone } });
      if (usedByUser >= coupon.maxUsesPerUser) return NextResponse.json({ valid: false, error: "Ya usaste este cupón el máximo de veces" });
    }

    const discount = computeDiscount(coupon, Number(subtotal) || 0, Number(deliveryFee) || 0);
    return NextResponse.json({
      valid: true,
      discount,
      coupon: {
        id: coupon.id, code: coupon.code, type: coupon.type, label: coupon.label, freeProductId: coupon.freeProductId,
        discountType: coupon.discountType, discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount, discountIncludesDelivery: coupon.discountIncludesDelivery,
      },
    });
  } catch (e) {
    console.error("[ecommerce/coupons/validate]", e);
    return NextResponse.json({ valid: false, error: "Error al validar" });
  }
}
