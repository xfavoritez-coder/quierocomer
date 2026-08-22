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
    const { restaurantSlug, restaurantId, code, subtotal, orderType, phone } = body as {
      restaurantSlug?: string; restaurantId?: string; code?: string; subtotal?: number; orderType?: string; phone?: string;
    };
    if ((!restaurantSlug && !restaurantId) || !code) return NextResponse.json({ valid: false, error: "Datos incompletos" });

    const restaurant = await (restaurantId
      ? prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, ecommerceEnabled: true, ecommerceCoupons: true } })
      : prisma.restaurant.findUnique({ where: { slug: restaurantSlug! }, select: { id: true, ecommerceEnabled: true, ecommerceCoupons: true } }));
    if (!restaurant || !restaurant.ecommerceEnabled) return NextResponse.json({ valid: false, error: "Tienda no disponible" });

    const coupon = parseCoupons(restaurant.ecommerceCoupons).find((c) => c.code === String(code).toUpperCase().trim());
    if (!coupon) return NextResponse.json({ valid: false, error: "Cupón no encontrado" });

    const oType = orderType === "DELIVERY" ? "DELIVERY" : "PICKUP";
    const base = validateCoupon(coupon, { subtotal: Number(subtotal) || 0, orderType: oType });
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

    const discount = computeDiscount(coupon, Number(subtotal) || 0);
    return NextResponse.json({
      valid: true,
      discount,
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type, label: coupon.label, freeProductId: coupon.freeProductId },
    });
  } catch (e) {
    console.error("[ecommerce/coupons/validate]", e);
    return NextResponse.json({ valid: false, error: "Error al validar" });
  }
}
