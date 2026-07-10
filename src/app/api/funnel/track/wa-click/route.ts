import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Track WhatsApp click — redirects to carta URL after recording the click.
 * GET /api/funnel/track/wa-click?lid=<leadId>&url=<destination>
 */
export async function GET(req: NextRequest) {
  const lid = req.nextUrl.searchParams.get("lid");
  const url = req.nextUrl.searchParams.get("url");

  if (lid) {
    // Only record click if WhatsApp was actually sent
    const lead = await prisma.lead.findUnique({ where: { id: lid }, select: { whatsappSentAt: true, openedVia: true } }).catch(() => null);
    if (lead?.whatsappSentAt) {
      prisma.lead.update({
        where: { id: lid },
        data: {
          whatsappClickedAt: new Date(),
          ...(!lead.openedVia ? { openedVia: "whatsapp" } : {}),
        },
      }).catch(() => {});
    }
  }

  return NextResponse.redirect(url || "https://quierocomer.com", { status: 302 });
}
