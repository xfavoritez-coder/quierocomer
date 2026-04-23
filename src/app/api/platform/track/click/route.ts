import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");
  const email = req.nextUrl.searchParams.get("e");
  const url = req.nextUrl.searchParams.get("url");

  if (cid && email) {
    prisma.platformCampaignContact.updateMany({
      where: { campaignId: cid, email, clickedAt: null },
      data: { clickedAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.redirect(url || "https://quierocomer.cl");
}
