import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/lead/[id]/activities
 * Carga lazy del historial de acciones del owner en el panel.
 * Solo se llama cuando el admin expande el detalle de un lead.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { convertedToOwnerId: true },
    });

    if (!lead?.convertedToOwnerId) {
      return NextResponse.json({ activities: [] });
    }

    // Find all restaurants for this owner
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId: lead.convertedToOwnerId },
      select: { id: true, name: true },
    });

    if (restaurants.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    const restaurantIds = restaurants.map((r) => r.id);

    const activities = await prisma.panelActivity.findMany({
      where: { restaurantId: { in: restaurantIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        details: true,
        ip: true,
        createdAt: true,
        restaurantId: true,
      },
    });

    return NextResponse.json({
      activities: activities.map((a) => ({
        ...a,
        restaurantName: restaurants.find((r) => r.id === a.restaurantId)?.name,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[lead/activities] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
