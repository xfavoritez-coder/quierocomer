import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  try {
    await requireRestaurantForOwner(req, restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true, logoUrl: true, address: true, phone: true, subscriptionStatus: true, billingExempt: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true },
  });

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      discountPrice: true,
      photos: true,
      categoryId: true,
      position: true,
    },
  });

  const isPaid = restaurant.subscriptionStatus === "ACTIVE" || restaurant.billingExempt === true;
  return NextResponse.json({ restaurant, categories, dishes, isPaid });
}
