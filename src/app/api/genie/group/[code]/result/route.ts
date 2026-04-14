import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGroupRecommendation } from "@/lib/genie-group";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const userLat = Number(req.nextUrl.searchParams.get("lat")) || undefined;
    const userLng = Number(req.nextUrl.searchParams.get("lng")) || undefined;

    const group = await prisma.groupSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: { orderBy: { joinedAt: "asc" } } },
    });
    if (!group) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const result = await getGroupRecommendation(group.id, userLat, userLng);
    return NextResponse.json({ group, result });
  } catch (e) {
    console.error("[Group result]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
