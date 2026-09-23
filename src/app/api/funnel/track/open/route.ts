import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Minimum delay to filter Gmail/Outlook pre-fetch
const MIN_OPEN_DELAY_MS = 10_000;

export async function GET(req: NextRequest) {
  const lid = req.nextUrl.searchParams.get("lid");
  const type = req.nextUrl.searchParams.get("type");

  if (lid) {
    const lead = await prisma.lead.findUnique({
      where: { id: lid },
      select: { id: true, deliveredAt: true, emailOpenedAt: true, events: true },
    });

    if (lead) {
      const deliveredAt = lead.deliveredAt ? new Date(lead.deliveredAt).getTime() : 0;
      const elapsed = Date.now() - deliveredAt;

      if (type === "qr_nudge") {
        // Track nudge open in events array
        const events = (lead.events as any[] | null) ?? [];
        const alreadyOpened = events.some((e: any) => e.type === "qr_nudge_opened");
        if (!alreadyOpened && elapsed >= MIN_OPEN_DELAY_MS) {
          await prisma.lead.update({
            where: { id: lid },
            data: { events: [...events, { type: "qr_nudge_opened", at: new Date().toISOString() }] },
          }).catch(() => {});
        }
      } else if (!lead.emailOpenedAt && elapsed >= MIN_OPEN_DELAY_MS) {
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
