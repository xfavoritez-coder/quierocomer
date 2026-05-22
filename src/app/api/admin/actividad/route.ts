import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isDemo: false, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, slug: true, plan: true, subscriptionStatus: true,
        trialEndsAt: true, logoUrl: true,
        createdAt: true, updatedAt: true,
        owner: { select: { name: true, email: true, lastLoginAt: true, updatedAt: true } },
        _count: { select: { dishes: true, categories: true, sessions: true, promotions: true } },
      },
    });

    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const locales = await Promise.all(restaurants.map(async (r) => {
      // Last edited dish
      const lastEditedDish = await prisma.dish.findFirst({
        where: { restaurantId: r.id },
        orderBy: { updatedAt: "desc" },
        select: { name: true, updatedAt: true, createdAt: true },
      });

      // Recent sessions (last 7 days)
      const recentSessions = await prisma.session.count({
        where: { restaurantId: r.id, startedAt: { gte: weekAgo } },
      });

      // Photos uploaded (not referential)
      const photosUploaded = await prisma.dish.count({
        where: { restaurantId: r.id, photos: { isEmpty: false }, isPhotoReferential: false },
      });

      // Dishes edited by owner (updatedAt differs from createdAt by >1 min)
      const allDishes = await prisma.dish.findMany({
        where: { restaurantId: r.id },
        select: { updatedAt: true, createdAt: true },
      });
      const editedDishes = allDishes.filter(d => d.updatedAt.getTime() - d.createdAt.getTime() > 60000).length;

      const ownerLastActive = r.owner?.updatedAt || r.owner?.lastLoginAt || null;
      const lastDishEdit = lastEditedDish && (lastEditedDish.updatedAt.getTime() - lastEditedDish.createdAt.getTime() > 60000)
        ? { name: lastEditedDish.name, at: lastEditedDish.updatedAt }
        : null;

      // Status
      const lastActivity = ownerLastActive ? new Date(ownerLastActive).getTime() : r.updatedAt.getTime();
      const hoursSince = (Date.now() - lastActivity) / 3600000;
      const status = hoursSince < 48 ? "active" : hoursSince < 168 ? "inactive" : "dormant";

      // Trial days left
      let trialDaysLeft: number | null = null;
      if (r.subscriptionStatus === "TRIALING" && r.trialEndsAt) {
        trialDaysLeft = Math.max(0, Math.ceil((new Date(r.trialEndsAt).getTime() - Date.now()) / 86400000));
      }

      return {
        id: r.id, name: r.name, slug: r.slug, plan: r.plan,
        subscriptionStatus: r.subscriptionStatus, trialDaysLeft,
        logoUrl: r.logoUrl, createdAt: r.createdAt, updatedAt: r.updatedAt,
        owner: r.owner ? { name: r.owner.name, email: r.owner.email, lastActive: ownerLastActive } : null,
        dishes: r._count.dishes, categories: r._count.categories,
        totalSessions: r._count.sessions, recentSessions,
        promotions: r._count.promotions,
        editedDishes, photosUploaded, lastDishEdit, status,
      };
    }));

    return NextResponse.json({ locales });
  } catch (error) {
    console.error("[Admin Actividad]", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
