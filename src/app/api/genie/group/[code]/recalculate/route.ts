import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGroupRecommendation } from "@/lib/genie-group";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { sessionId, selectedDishes, userLat, userLng } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });

    const group = await prisma.groupSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: true },
    });
    if (!group) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    // Update this member's selections
    await prisma.groupMember.updateMany({
      where: { groupId: group.id, sessionId },
      data: { selectedDishes: selectedDishes ?? [], estado: "READY" },
    });

    // Recalculate
    await prisma.groupSession.update({ where: { id: group.id }, data: { estado: "CALCULATING" } });
    const result = await getGroupRecommendation(group.id, userLat, userLng);

    if (result) {
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

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[Group recalculate]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
