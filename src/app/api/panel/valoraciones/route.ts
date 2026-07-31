import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; googleReviewUrl?: string | null; reviewReward?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, googleReviewUrl, reviewReward } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  // Verify ownership
  let allowed = false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    allowed = m?.restaurantId === restaurantId;
  } else {
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
    allowed = r?.ownerId === panelId;
  }
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      googleReviewUrl: googleReviewUrl ?? null,
      reviewReward: reviewReward ?? null,
    },
    select: { slug: true },
  });

  revalidatePath(`/${updated.slug}`);

  return NextResponse.json({ ok: true });
}
