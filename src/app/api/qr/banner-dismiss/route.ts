import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * POST /api/qr/banner-dismiss
 * Body: { slug: string }
 *
 * Called when the owner clicks "Ir al panel →" or dismisses the OwnerPanelBar.
 * Sets lead.panelVisitedAt so the banner is hidden server-side for ALL devices,
 * then revalidates the /qr/[slug] ISR cache so the next request won't include the banner HTML.
 */
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (!slug || typeof slug !== "string") return NextResponse.json({ ok: false });

    await prisma.lead.updateMany({
      where: { generatedSlug: slug, panelVisitedAt: null },
      data: { panelVisitedAt: new Date() },
    });

    revalidatePath(`/qr/${slug}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
