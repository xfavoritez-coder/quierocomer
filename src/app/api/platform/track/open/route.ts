import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// 5 minutes minimum after send to count as real open (filters Gmail/Outlook/Yahoo pre-fetch)
const MIN_DELAY_MS = 5 * 60 * 1000;

// Known bot/proxy user-agent patterns
const BOT_PATTERNS = [
  /GoogleImageProxy/i,
  /GoogleMailProxy/i,
  /YahooMailProxy/i,
  /Outlook/i,
  /Microsoft Office/i,
  /bot/i,
  /crawler/i,
  /spider/i,
  /prefetch/i,
  /pre-fetch/i,
  /wget/i,
  /curl/i,
  /fetch/i,
  /link.?preview/i,
];

function isBot(ua: string | null): boolean {
  if (!ua) return true; // No UA = likely a bot
  return BOT_PATTERNS.some((p) => p.test(ua));
}

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");
  const email = req.nextUrl.searchParams.get("e");
  const ua = req.headers.get("user-agent");

  if (cid && email && !isBot(ua)) {
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
