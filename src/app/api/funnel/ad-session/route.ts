import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, fbclid, landingPage, referrer, device } = body;

    if (!sessionId || !utmSource) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.adSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        utmSource,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
        fbclid: fbclid || null,
        ip,
        userAgent,
        referrer: referrer || null,
        landingPage: landingPage || null,
        device: device || null,
      },
      update: {}, // Already exists, skip
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AdSession]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
