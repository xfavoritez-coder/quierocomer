import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    }

    const calls = await prisma.waiterCall.findMany({
      where: { restaurantId, answeredAt: null },
      orderBy: { calledAt: "desc" },
      include: { table: true },
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error("Active calls error:", error);
    return NextResponse.json({ error: "Failed to fetch calls" }, { status: 500 });
  }
}
