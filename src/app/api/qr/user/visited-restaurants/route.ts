import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;
  if (!userId) return NextResponse.json({ restaurants: [] });

  const interactions = await prisma.qRUserInteraction.findMany({
    where: { userId },
    include: { restaurant: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Deduplicate by restaurant
  const seen = new Set<string>();
  const restaurants = interactions
    .filter((i) => {
      if (seen.has(i.restaurantId)) return false;
      seen.add(i.restaurantId);
      return true;
    })
    .map((i) => ({ restaurant: i.restaurant, lastVisit: i.createdAt }));

  return NextResponse.json({ restaurants });
}
