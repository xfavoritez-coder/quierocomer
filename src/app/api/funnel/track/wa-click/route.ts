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
    prisma.lead.update({
      where: { id: lid },
      data: {
        whatsappClickedAt: new Date(),
        // Only set openedVia if not already set (first wins)
        ...(!await prisma.lead.findUnique({ where: { id: lid }, select: { openedVia: true } }).then(l => l?.openedVia) ? { openedVia: "whatsapp" } : {}),
      },
    }).catch(() => {});
  }

  return NextResponse.redirect(url || "https://quierocomer.cl", { status: 302 });
}
