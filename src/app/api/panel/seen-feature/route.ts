import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID = new Set(["loyalty", "valoraciones", "ordering", "administracion"]);

export async function POST(req: NextRequest) {
  const token = req.cookies.get("panel_token")?.value;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!token || !panelId) return NextResponse.json({ ok: false }, { status: 401 });

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
