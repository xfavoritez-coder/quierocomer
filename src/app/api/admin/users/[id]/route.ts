import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  try {
    const user = await prisma.qRUser.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 20,
          select: { id: true, startedAt: true, endedAt: true, restaurantId: true, restaurant: { select: { name: true, slug: true } } },
        },
        dishFavorites: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, createdAt: true, dish: { select: { name: true, photos: true } }, restaurant: { select: { name: true } } },
        },
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { id: true, type: true, createdAt: true, restaurant: { select: { name: true } } },
        },
        campaignRecipients: {
          orderBy: { sentAt: "desc" },
          take: 15,
          select: { id: true, sentAt: true, openedAt: true, clickedAt: true, campaign: { select: { name: true } } },
        },
        statEvents: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { id: true, eventType: true, createdAt: true, restaurant: { select: { name: true } } },
        },
      },
    });

    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Restaurants visited
    const restaurantIds = new Set<string>();
    user.sessions.forEach(s => restaurantIds.add(s.restaurantId));
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: Array.from(restaurantIds) } },
      select: { id: true, name: true, slug: true },
    });

    // Engagement score: sessions * 2 + favorites * 3 + interactions
    const engagementScore = user.sessions.length * 2 + user.dishFavorites.length * 3 + user.interactions.length;

    // Segments this user belongs to
    const segments = await prisma.segment.findMany({
      select: { id: true, name: true, restaurantId: true, rules: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        birthDate: user.birthDate,
        dietType: user.dietType,
        restrictions: user.restrictions,
        dislikes: user.dislikes,
        verifiedAt: user.verifiedAt,
        createdAt: user.createdAt,
        unsubscribedAt: user.unsubscribedAt,
        lastEmailAt: user.lastEmailAt,
      },
      engagementScore,
      restaurants,
      sessions: user.sessions,
      favorites: user.dishFavorites,
      interactions: user.interactions,
      campaigns: user.campaignRecipients,
      events: user.statEvents,
    });
  } catch (e) {
    console.error("[Admin user detail]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
