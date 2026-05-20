import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, duration, maxScroll, interactions, sectionsViewed, events, exitPage, bounced, leadId } = body;

    if (!sessionId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const existing = await prisma.adSession.findUnique({
      where: { sessionId },
      select: { id: true, events: true, duration: true, maxScroll: true, interactions: true, sectionsViewed: true, pageViews: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "session not found" }, { status: 404 });
    }

    // Merge events and update max values
    const mergedSections = Array.from(new Set([
      ...(existing.sectionsViewed || []),
      ...(sectionsViewed || []),
    ]));

    const newEvents = (events || []).map((e: any) => ({
      ...e,
      ts: typeof e.ts === "number" ? e.ts + (existing.duration * 1000) : e.ts,
    }));

    await prisma.adSession.update({
      where: { sessionId },
      data: {
        duration: Math.max(existing.duration, duration || 0),
        maxScroll: Math.max(existing.maxScroll, maxScroll || 0),
        interactions: existing.interactions + (interactions || 0),
        sectionsViewed: mergedSections,
        pageViews: existing.pageViews + (newEvents.filter((e: any) => e.type === "page_load").length),
        events: { push: newEvents },
        ...(exitPage && { exitPage }),
        ...(bounced === false && { bounced: false }),
        ...(leadId && { leadId, converted: true }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AdEvent]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
