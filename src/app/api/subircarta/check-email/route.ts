import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ hasActive: false, isDemo: false });

  const owner = await prisma.restaurantOwner.findUnique({
    where: { email },
    select: {
      restaurants: {
        where: { isActive: true },
        select: { id: true, isDemo: true },
        take: 1,
      },
    },
  });

  if (!owner || owner.restaurants.length === 0) {
    return NextResponse.json({ hasActive: false, isDemo: false });
  }

  const isDemo = owner.restaurants[0].isDemo;
  return NextResponse.json({ hasActive: !isDemo, isDemo });
}
