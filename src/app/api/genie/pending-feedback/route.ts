import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!userId && !sessionId) return NextResponse.json(null);

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find last SELECTED interaction older than 2 hours, within 7 days
    const interaction = await prisma.interaction.findFirst({
      where: {
        action: "SELECTED",
        createdAt: { lt: twoHoursAgo, gt: sevenDaysAgo },
        ...(userId ? { userId } : { sessionId: sessionId! }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        menuItemId: true,
        menuItem: { select: { nombre: true, imagenUrl: true } },
      },
    });

    if (!interaction) return NextResponse.json(null);

    // Check if already rated
    const existingRating = await prisma.dishRating.findFirst({
      where: {
        menuItemId: interaction.menuItemId,
        ...(userId ? { userId } : { sessionId: sessionId! }),
      },
    });

    if (existingRating) return NextResponse.json(null);

    return NextResponse.json({
      interactionId: interaction.id,
      dishName: interaction.menuItem.nombre,
      dishImage: interaction.menuItem.imagenUrl,
    });
  } catch {
    return NextResponse.json(null);
  }
}
