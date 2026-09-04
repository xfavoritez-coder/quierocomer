import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { suggestPromotions } from "@/lib/genio/suggestPromotions";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  requireRestaurantForOwner,
  authErrorResponse,
  isSuperAdmin,
} from "@/lib/adminAuth";
import { logActivity } from "@/lib/admin/logActivity";

async function revalidateRestaurant(restaurantId: string) {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  if (r?.slug) revalidateTag(`qr-restaurant-${r.slug}`, "minutes");
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    const validated = await requireRestaurantForOwner(req, restaurantId);

    const where: any = { status: { not: "DELETED" } };
    if (validated) where.restaurantId = validated;

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        restaurant: { select: { name: true, logoUrl: true } },
        modifierTemplates: { select: { id: true, name: true } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    const allDishIds = promotions.flatMap((p) => p.dishIds);
    const dishes = allDishIds.length
      ? await prisma.dish.findMany({
          where: { id: { in: allDishIds } },
          select: { id: true, name: true, price: true, photos: true },
        })
      : [];
    const dishMap = Object.fromEntries(dishes.map((d) => [d.id, d]));

    const enriched = promotions.map((p) => ({
      ...p,
      dishes: p.dishIds.map((id) => dishMap[id]).filter(Boolean),
    }));

    return NextResponse.json({ promotions: enriched });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Promotions GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();

    // Generate AI suggestions
    if (body.action === "suggest") {
      await assertOwnsRestaurant(req, body.restaurantId);
      const suggestions = await suggestPromotions(body.restaurantId);

      const created = [];
      for (const s of suggestions) {
        const promo = await prisma.promotion.create({
          data: {
            restaurantId: body.restaurantId,
            name: s.name,
            description: s.description,
            dishIds: s.dishIds,
            originalPrice: s.originalPrice,
            promoPrice: s.promoPrice,
            discountPct: s.discountPct,
            status: "SUGGESTED",
            generatedBy: "ai",
            aiJustification: s.justification,
          },
        });
        created.push({ ...promo, targetSegment: s.targetSegment, emailCopy: s.emailCopy, dishNames: s.dishNames });
      }

      return NextResponse.json({ ok: true, promotions: created });
    }

    // Create manual promotion
    const { restaurantId, name, description, promoType, imageUrl, thumbUrl, dishIds, originalPrice, promoPrice, discountPct, validFrom, validUntil, daysOfWeek, modifierTemplateIds } = body;
    if (!restaurantId || !name) return NextResponse.json({ error: "restaurantId and name required" }, { status: 400 });

    await assertOwnsRestaurant(req, restaurantId);

    const promoData: any = {
      restaurantId, name, description: description || null,
      promoType: promoType || "product",
      imageUrl: imageUrl || null,
      thumbUrl: thumbUrl || null,
      dishIds: dishIds || [], originalPrice, promoPrice, discountPct,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      status: "ACTIVE", generatedBy: "manual",
      modifierTemplates: Array.isArray(modifierTemplateIds) && modifierTemplateIds.length
        ? { connect: modifierTemplateIds.map((id: string) => ({ id })) }
        : undefined,
    };
    const promo = await prisma.promotion.create({ data: promoData, include: { modifierTemplates: { select: { id: true, name: true } } } });

    // Sync dish.discountPrice so pedidos online shows the same price as the carta QR promo
    if (promo.status === "ACTIVE" && promo.promoPrice && promo.dishIds.length > 0) {
      await prisma.dish.updateMany({
        where: { id: { in: promo.dishIds } },
        data: { discountPrice: promo.promoPrice },
      });
    }

    await revalidateRestaurant(restaurantId);
    logActivity(restaurantId, "promo_create", { promoId: promo.id, name, promoPrice, originalPrice });
    return NextResponse.json({ promotion: promo });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Promotion error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();

    // Bulk reorder
    if (body.action === "reorder" && Array.isArray(body.order)) {
      const restaurantId = await requireRestaurantForOwner(req, body.restaurantId);
      for (let i = 0; i < body.order.length; i++) {
        await prisma.promotion.update({ where: { id: body.order[i] }, data: { position: i } });
      }
      return NextResponse.json({ ok: true });
    }

    const { id, status, modifierTemplateIds, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Ownership check
    const existing = await prisma.promotion.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
    await assertOwnsRestaurant(req, existing.restaurantId);

    const promo = await prisma.promotion.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.promoPrice !== undefined && { promoPrice: data.promoPrice }),
        ...(data.originalPrice !== undefined && { originalPrice: data.originalPrice }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.validFrom !== undefined && { validFrom: data.validFrom ? new Date(data.validFrom) : null }),
        ...(data.validUntil !== undefined && { validUntil: data.validUntil ? new Date(data.validUntil) : null }),
        ...(data.daysOfWeek !== undefined && { daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [] }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.featured !== undefined && { featured: data.featured }),
        ...(Array.isArray(modifierTemplateIds) && { modifierTemplates: { set: modifierTemplateIds.map((mid: string) => ({ id: mid })) } }),
      },
      include: { modifierTemplates: { select: { id: true, name: true } } },
    });

    // Sync isHero on promo dishes when featured flag changes
    if (data.featured !== undefined && promo.dishIds.length > 0) {
      await prisma.dish.updateMany({
        where: { id: { in: promo.dishIds } },
        data: { isHero: data.featured },
      });
    }

    // Sync dish.discountPrice so pedidos online matches carta QR promo price
    if (promo.dishIds.length > 0) {
      const isNowActive = promo.status === "ACTIVE";
      if (isNowActive && promo.promoPrice) {
        // Active promo: apply discountPrice to all dishes
        await prisma.dish.updateMany({
          where: { id: { in: promo.dishIds } },
          data: { discountPrice: promo.promoPrice },
        });
      } else if (!isNowActive) {
        // Inactive/deleted promo: clear discountPrice
        await prisma.dish.updateMany({
          where: { id: { in: promo.dishIds } },
          data: { discountPrice: null },
        });
      }
    }

    await revalidateRestaurant(existing.restaurantId);
    logActivity(existing.restaurantId, "promo_edit", { promoId: id, name: promo.name, status: promo.status });
    return NextResponse.json({ promotion: promo });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Promotion update error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
