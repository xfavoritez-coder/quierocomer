import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1×1 transparent GIF
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** GET /api/pos/survey/track-open?oid=<posOrderId>
 *  Tracking pixel: registra la primera apertura del email de encuesta. */
export async function GET(req: NextRequest) {
  const oid = req.nextUrl.searchParams.get("oid") || "";
  if (oid) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.posOrder.updateMany as any)({
      where: { id: oid, surveyEmailOpenedAt: null },
      data: { surveyEmailOpenedAt: new Date() },
    }).catch(() => {});
  }
  return new NextResponse(GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
