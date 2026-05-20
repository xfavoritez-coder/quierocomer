import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { page, referrer, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, fbclid } = body;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.funnelVisit.create({
      data: {
        page: page || "subircarta",
        ip,
        userAgent,
        referrer: referrer || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
        fbclid: fbclid || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FunnelVisit]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
