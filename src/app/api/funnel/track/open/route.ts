import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Minimum delay to filter Gmail/Outlook pre-fetch
const MIN_OPEN_DELAY_MS = 10_000;

export async function GET(req: NextRequest) {
  const lid = req.nextUrl.searchParams.get("lid");

  if (lid) {
    const lead = await prisma.lead.findUnique({
      where: { id: lid },
      select: { id: true, deliveredAt: true, emailOpenedAt: true },
    });

    if (lead && !lead.emailOpenedAt) {
      const deliveredAt = lead.deliveredAt ? new Date(lead.deliveredAt).getTime() : 0;
      const elapsed = Date.now() - deliveredAt;

      if (elapsed >= MIN_OPEN_DELAY_MS) {
        await prisma.lead.update({
          where: { id: lid },
          data: { emailOpenedAt: new Date() },
        }).catch(() => {});
      }
    }
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
  });
}
