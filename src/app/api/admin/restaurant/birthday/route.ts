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

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { birthdayEmailEnabled: true, birthdayPerk: true },
    });

    // Birthday email history with visit matching
    const logs = await prisma.birthdayEmailLog.findMany({
      where: { restaurantId },
      include: { qrUser: { select: { name: true, email: true } } },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    const totalSent = await prisma.birthdayEmailLog.count({ where: { restaurantId } });
    const totalVisited = await prisma.birthdayEmailLog.count({ where: { restaurantId, visitedAt: { not: null } } });

    return NextResponse.json({
      birthdayEmailEnabled: restaurant?.birthdayEmailEnabled || false,
      birthdayPerk: restaurant?.birthdayPerk || "",
      logs,
      kpi: {
        sent: totalSent,
        visited: totalVisited,
        rate: totalSent > 0 ? Math.round((totalVisited / totalSent) * 100) : 0,
      },
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Birthday GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, birthdayEmailEnabled, birthdayPerk } = await req.json();
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    // Validation: perk is required to enable
    if (birthdayEmailEnabled && (!birthdayPerk || !birthdayPerk.trim())) {
      return NextResponse.json({ error: "Debes indicar el regalo para activar los emails de cumpleaños" }, { status: 400 });
    }

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        birthdayEmailEnabled: !!birthdayEmailEnabled,
        birthdayPerk: birthdayPerk?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Birthday PUT error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
