import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPanelId } from "@/lib/session";

const VALID = new Set(["loyalty", "valoraciones", "ordering", "administracion"]);

export async function POST(req: NextRequest) {
  const panelId = getPanelId(req);
  if (!panelId) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { feature } = await req.json();
    if (!feature || !VALID.has(feature)) return NextResponse.json({ ok: false }, { status: 400 });

    if (panelId.startsWith("tm_")) {
      const memberId = panelId.slice(3);
      await prisma.teamMember.update({
        where: { id: memberId },
        data: { seenFeatures: { push: feature } },
      });
    } else {
      await prisma.restaurantOwner.update({
        where: { id: panelId },
        data: { seenFeatures: { push: feature } },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
