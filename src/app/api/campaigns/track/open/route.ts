import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent pixel
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");
  const uid = req.nextUrl.searchParams.get("uid");

  if (cid && uid) {
    prisma.campaignRecipient.updateMany({
      where: { campaignId: cid, qrUserId: uid, openedAt: null },
      data: { openedAt: new Date() },
    }).catch(() => {});
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
  });
}
