import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { menuItemIds, action, userId, sessionId, visitId, ctxCompany, ctxHunger, ctxBudget, ctxOccasion, weatherTemp, weatherCondition, weatherHumidity, userLat, userLng } = body;

    if (!menuItemIds?.length || !action || !sessionId) {
      return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    const now = new Date();
    const interactions = await prisma.interaction.createMany({
      data: menuItemIds.map((menuItemId: string) => ({
        menuItemId,
        action,
        userId: userId || null,
        sessionId,
        visitId: visitId || null,
        ctxCompany: ctxCompany || null,
        ctxHunger: ctxHunger || null,
        ctxBudget: ctxBudget ? Number(ctxBudget) : null,
        ctxOccasion: ctxOccasion || null,
        weatherTemp: weatherTemp ?? null,
        weatherCondition: weatherCondition || null,
        weatherHumidity: weatherHumidity ?? null,
        userLat: userLat ?? null,
        userLng: userLng ?? null,
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
      })),
    });

    // Update stats on menu items
    if (action === "SELECTED") {
      await Promise.all(menuItemIds.map((id: string) =>
        prisma.menuItem.update({ where: { id }, data: { totalSelected: { increment: 1 } } }).catch(() => {})
      ));
    } else if (action === "VIEWED") {
      await Promise.all(menuItemIds.map((id: string) =>
        prisma.menuItem.update({ where: { id }, data: { totalViews: { increment: 1 } } }).catch(() => {})
      ));
    }

    return NextResponse.json({ count: interactions.count });
  } catch (e) {
    console.error("[Genie interaction]", e);
    return NextResponse.json({ error: "Error al registrar interaccion" }, { status: 500 });
  }
}
