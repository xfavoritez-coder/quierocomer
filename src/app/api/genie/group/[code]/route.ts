import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const group = await prisma.groupSession.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        members: {
          select: { id: true, nombre: true, estado: true, sessionId: true, userId: true, joinedAt: true, readyAt: true, selectedDishes: true, recommendedDishId: true },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!group) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
    if (group.expiresAt < new Date() && group.estado === "WAITING") {
      await prisma.groupSession.update({ where: { id: group.id }, data: { estado: "EXPIRED" } });
      return NextResponse.json({ error: "Sala expirada" }, { status: 410 });
    }

    return NextResponse.json(group);
  } catch (e) {
    console.error("[Group get]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
