import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");
  const uid = req.nextUrl.searchParams.get("uid");
  const url = req.nextUrl.searchParams.get("url");

  if (cid && uid) {
    prisma.campaignRecipient.updateMany({
      where: { campaignId: cid, qrUserId: uid, clickedAt: null },
      data: { clickedAt: new Date() },
    }).catch(() => {});
  }

  // Redirect to destination
  const destination = url || "https://quierocomer.cl";
  return NextResponse.redirect(destination);
}
