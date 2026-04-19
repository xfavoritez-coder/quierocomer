import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { suggestPromotions } from "@/lib/genio/suggestPromotions";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const showAll = req.nextUrl.searchParams.get("all") === "true";

  const where: any = { status: { not: "DELETED" } };
  if (restaurantId) where.restaurantId = restaurantId;

  const promotions = await prisma.promotion.findMany({
    where,
    include: { restaurant: { select: { name: true, logoUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Resolve dish names
  const allDishIds = promotions.flatMap(p => p.dishIds);
  const dishes = allDishIds.length ? await prisma.dish.findMany({
    where: { id: { in: allDishIds } }, select: { id: true, name: true, price: true, photos: true },
  }) : [];
  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

  const enriched = promotions.map(p => ({
    ...p,
    dishes: p.dishIds.map(id => dishMap[id]).filter(Boolean),
  }));

  return NextResponse.json({ promotions: enriched });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const body = await req.json();

    // Generate AI suggestions
    if (body.action === "suggest") {
      const suggestions = await suggestPromotions(body.restaurantId);

      // Save as SUGGESTED promotions
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
    const { restaurantId, name, description, promoType, imageUrl, thumbUrl, dishIds, originalPrice, promoPrice, discountPct, validFrom, validUntil } = body;
    if (!restaurantId || !name) return NextResponse.json({ error: "restaurantId and name required" }, { status: 400 });

    const promoData: any = {
      restaurantId, name, description: description || null,
      promoType: promoType || "product",
      imageUrl: imageUrl || null,
      thumbUrl: thumbUrl || null,
      dishIds: dishIds || [], originalPrice, promoPrice, discountPct,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      status: "ACTIVE", generatedBy: "manual",
    };
    const promo = await prisma.promotion.create({ data: promoData });
    return NextResponse.json({ promotion: promo });
  } catch (error: any) {
    console.error("Promotion error:", error);
    return NextResponse.json({ error: error.message || "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const { id, status, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

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
      },
    });
    return NextResponse.json({ promotion: promo });
  } catch (error) {
    console.error("Promotion update error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
