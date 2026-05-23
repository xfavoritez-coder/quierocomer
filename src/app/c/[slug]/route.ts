import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /c/:slug
 * Short URL for WhatsApp carta links. Tracks the click and redirects to the carta.
 * Equivalent to /api/funnel/track/wa-click but with a clean URL.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const destination = `${process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl"}/qr/${slug}`;

  // Find the lead by slug and track WhatsApp click
  const lead = await prisma.lead.findFirst({
    where: { generatedSlug: slug },
    orderBy: { createdAt: "desc" },
    select: { id: true, whatsappSentAt: true, openedVia: true },
  }).catch(() => null);

  if (lead?.whatsappSentAt) {
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        whatsappClickedAt: new Date(),
        ...(!lead.openedVia ? { openedVia: "whatsapp" } : {}),
      },
    }).catch(() => {});
  }

  return NextResponse.redirect(destination, { status: 302 });
}
