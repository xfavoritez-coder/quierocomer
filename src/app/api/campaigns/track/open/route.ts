import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent pixel
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Minimum seconds after send to count as real open (filters Gmail pre-fetch)
const MIN_OPEN_DELAY_MS = 10_000;

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");
  const uid = req.nextUrl.searchParams.get("uid");

  if (cid && uid) {
    // Find the recipient and check if enough time has passed since send
    const recipient = await prisma.campaignRecipient.findFirst({
      where: { campaignId: cid, qrUserId: uid, openedAt: null },
      select: { id: true, sentAt: true },
    });

    if (recipient) {
      const sentAt = recipient.sentAt ? new Date(recipient.sentAt).getTime() : 0;
      const elapsed = Date.now() - sentAt;

      // Only count as opened if at least 10 seconds after send
      if (elapsed >= MIN_OPEN_DELAY_MS) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { openedAt: new Date() },
        }).catch(() => {});
      }
    }
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
  });
}
