import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * GET /api/funnel/track/weekly-open?eid=<emailLogId>
 * Tracking pixel for weekly email opens.
 */
export async function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid");

  if (eid) {
    // Update EmailLog — add openedAt via errorMsg field (reusing existing field)
    prisma.emailLog.update({
      where: { id: eid },
      data: { errorMsg: `opened:${new Date().toISOString()}` },
    }).catch(() => {});
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
  });
}
