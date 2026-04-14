import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGroupRecommendation } from "@/lib/genie-group";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { sessionId, selectedDishes, ctxHunger, ctxBudget, userLat, userLng } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });

    const group = await prisma.groupSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: true },
    });
    if (!group) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

    // Update member as ready with their selections
    await prisma.groupMember.updateMany({
      where: { groupId: group.id, sessionId },
      data: {
        estado: "READY",
        selectedDishes: selectedDishes ?? [],
        ctxHunger: ctxHunger || null,
        ctxBudget: ctxBudget ? Number(ctxBudget) : null,
        readyAt: new Date(),
      },
    });

    // Check if ALL members are ready
    const updatedGroup = await prisma.groupSession.findUnique({
      where: { id: group.id },
      include: { members: true },
    });
    const allReady = updatedGroup!.members.every(m => m.estado === "READY");

    if (allReady) {
      // Calculate group recommendation
      await prisma.groupSession.update({ where: { id: group.id }, data: { estado: "CALCULATING" } });

      const result = await getGroupRecommendation(group.id, userLat, userLng);

      if (result) {
        // Save recommended dish per member
        for (const [memberId, dish] of Object.entries(result.bestLocal.dishesPerMember)) {
          await prisma.groupMember.update({
            where: { id: memberId },
            data: { recommendedDishId: (dish as any).id },
          });
        }
        await prisma.groupSession.update({
          where: { id: group.id },
          data: { estado: "READY", resultLocalId: result.bestLocal.localId },
        });
      } else {
        await prisma.groupSession.update({ where: { id: group.id }, data: { estado: "READY" } });
      }
    }

    return NextResponse.json({ allReady });
  } catch (e) {
    console.error("[Group ready]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
