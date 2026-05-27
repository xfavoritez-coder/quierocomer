import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * GET /api/email/track/open?eid=<emailLogId>
 * Returns a 1x1 transparent GIF and marks the email as opened.
 */
export async function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid");

  if (eid) {
    prisma.emailLog.updateMany({
      where: { id: eid, openedAt: null },
      data: { openedAt: new Date() },
    }).catch(() => {});
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
