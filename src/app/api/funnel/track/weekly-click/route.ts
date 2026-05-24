import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/funnel/track/weekly-click?eid=<emailLogId>&url=<destination>
 * Click tracker for weekly email CTAs.
 */
export async function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid");
  const url = req.nextUrl.searchParams.get("url");

  if (eid) {
    const current = await prisma.emailLog.findUnique({ where: { id: eid }, select: { errorMsg: true } }).catch(() => null);
    const openPart = current?.errorMsg?.startsWith("opened:") ? current.errorMsg : "";
    prisma.emailLog.update({
      where: { id: eid },
      data: { errorMsg: `${openPart}|clicked:${new Date().toISOString()}` },
    }).catch(() => {});
  }

  return NextResponse.redirect(url || "https://quierocomer.cl/panel", { status: 302 });
}
