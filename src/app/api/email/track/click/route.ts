import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/email/track/click?eid=<emailLogId>&url=<destinationUrl>
 * Marks the email as clicked and redirects to the destination URL.
 */
export async function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid");
  const url = req.nextUrl.searchParams.get("url");

  if (eid) {
    prisma.emailLog.updateMany({
      where: { id: eid, clickedAt: null },
      data: { clickedAt: new Date(), openedAt: new Date() },
    }).catch(() => {});
  }

  const destination = url || "https://quierocomer.com";
  return NextResponse.redirect(destination, 302);
}
