import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestPromotions } from "@/lib/genio/suggestPromotions";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  requireRestaurantForOwner,
  authErrorResponse,
  isSuperAdmin,
} from "@/lib/adminAuth";

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
      include: { restaurant: { select: { name: true, logoUrl: true } } },
      orderBy: { createdAt: "desc" },
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
    const { restaurantId, name, description, promoType, imageUrl, thumbUrl, dishIds, originalPrice, promoPrice, discountPct, validFrom, validUntil, daysOfWeek } = body;
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
    };
    const promo = await prisma.promotion.create({ data: promoData });
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
    const { id, status, ...data } = await req.json();
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
        ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
        ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
        ...(data.daysOfWeek !== undefined && { daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [] }),
      },
    });
    return NextResponse.json({ promotion: promo });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Promotion update error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
