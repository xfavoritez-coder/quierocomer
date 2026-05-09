import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    // Get QRUsers from interactions
    const interactions = await prisma.qRUserInteraction.findMany({
      where: { restaurantId },
      select: {
        type: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, birthDate: true, dietType: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also find users who registered via events (BIRTHDAY_SAVED, USER_REGISTERED)
    // in this restaurant but don't have an interaction record (e.g. existing accounts)
    const eventUsers = await prisma.statEvent.findMany({
      where: { restaurantId, qrUserId: { not: null }, eventType: { in: ["BIRTHDAY_SAVED", "USER_REGISTERED"] as any } },
      select: { qrUserId: true, eventType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const extraUserIds = [...new Set(eventUsers.filter(e => e.qrUserId).map(e => e.qrUserId!))];
    const extraUsers = extraUserIds.length
      ? await prisma.qRUser.findMany({
          where: { id: { in: extraUserIds } },
          select: { id: true, name: true, email: true, birthDate: true, dietType: true, createdAt: true },
        })
      : [];
    const extraUserMap = new Map(extraUsers.map(u => [u.id, u]));

    // Deduplicate by user ID
    const seen = new Set<string>();
    const clients: {
      id: string;
      name: string | null;
      email: string;
      birthDate: string | null;
      dietType: string | null;
      registeredAt: string;
      source: string;
    }[] = [];

    for (const i of interactions) {
      if (!i.user || seen.has(i.user.id)) continue;
      seen.add(i.user.id);
      clients.push({
        id: i.user.id, name: i.user.name, email: i.user.email,
        birthDate: i.user.birthDate?.toISOString() || null,
        dietType: i.user.dietType, registeredAt: i.user.createdAt.toISOString(),
        source: i.type.replace("_CONVERTED", ""),
      });
    }

    // Add users from events that weren't in interactions
    for (const e of eventUsers) {
      if (!e.qrUserId || seen.has(e.qrUserId)) continue;
      seen.add(e.qrUserId);
      const u = extraUserMap.get(e.qrUserId);
      if (!u) continue;
      clients.push({
        id: u.id, name: u.name, email: u.email,
        birthDate: u.birthDate?.toISOString() || null,
        dietType: u.dietType, registeredAt: u.createdAt.toISOString(),
        source: e.eventType === "BIRTHDAY_SAVED" ? "birthday_banner" : "event",
      });
    }

    clients.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

    return NextResponse.json({ clients, total: clients.length });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Panel clients]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
