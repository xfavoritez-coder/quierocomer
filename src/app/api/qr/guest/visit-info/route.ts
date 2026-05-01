import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId");
    const restaurantId = url.searchParams.get("restaurantId");
    if (!guestId) return NextResponse.json({ visitCount: 0, restaurantSessions: 0 });

    const guest = await prisma.guestProfile.findUnique({
      where: { id: guestId },
      select: { visitCount: true },
    });

    let restaurantSessions = 0;
    if (restaurantId) {
      restaurantSessions = await prisma.session.count({
        where: { guestId, restaurantId },
      });
    }

    return NextResponse.json({
      visitCount: guest?.visitCount || 0,
      restaurantSessions,
    });
  } catch {
    return NextResponse.json({ visitCount: 0, restaurantSessions: 0 });
  }
}
