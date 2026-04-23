import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  await prisma.platformCampaignContact.updateMany({
    where: { email },
    data: { unsubscribedAt: new Date() },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
