import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const MIN_DELAY_MS = 10_000;

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");
  const email = req.nextUrl.searchParams.get("e");

  if (cid && email) {
    const contact = await prisma.platformCampaignContact.findFirst({
      where: { campaignId: cid, email, openedAt: null },
      select: { id: true, sentAt: true },
    });

    if (contact) {
      const sentAt = contact.sentAt ? new Date(contact.sentAt).getTime() : 0;
      if (Date.now() - sentAt >= MIN_DELAY_MS) {
        await prisma.platformCampaignContact.update({
          where: { id: contact.id },
          data: { openedAt: new Date() },
        }).catch(() => {});
      }
    }
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
  });
}
