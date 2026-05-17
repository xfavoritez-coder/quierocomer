import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: id, isActive: true },
    select: { name: true },
    orderBy: { position: "asc" },
    take: 5,
  });
  return NextResponse.json({ dishes: dishes.map(d => d.name) });
}
