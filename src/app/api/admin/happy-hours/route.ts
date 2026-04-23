import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, getOwnedRestaurantIds, isSuperAdmin, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = new URL(req.url).searchParams.get("restaurantId");
    const where: any = {};

    if (restaurantId) {
      await requireRestaurantForOwner(req, restaurantId);
      where.restaurantId = restaurantId;
    } else if (!isSuperAdmin(req)) {
      const ownedIds = await getOwnedRestaurantIds(req);
      if (!ownedIds?.length) return NextResponse.json([]);
      where.restaurantId = { in: ownedIds };
    }

    const hours = await prisma.happyHour.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(hours);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { restaurantId, name, days, startTime, endTime, discountType, discountValue, categoryIds, dishIds, bannerText, bannerColor } = body;

    if (!restaurantId || !name || !days?.length || !startTime || !endTime || !discountType || discountValue == null) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
    }

    await requireRestaurantForOwner(req, restaurantId);

    const hh = await prisma.happyHour.create({
      data: {
        restaurantId,
        name,
        days,
        startTime,
        endTime,
        discountType,
        discountValue: Number(discountValue),
        categoryIds: categoryIds || [],
        dishIds: dishIds || [],
        bannerText: bannerText || null,
        bannerColor: bannerColor || "#f59e0b",
      },
    });
    return NextResponse.json(hh);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[HappyHour POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.happyHour.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, existing.restaurantId);

    if (data.discountValue != null) data.discountValue = Number(data.discountValue);

    const updated = await prisma.happyHour.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[HappyHour PUT]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.happyHour.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, existing.restaurantId);

    await prisma.happyHour.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
