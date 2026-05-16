import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/subircarta/event
 * Append a tracking event to a lead's event log.
 * Body: { leadId: string, action: string, ...metadata }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leadId, ...eventData } = body;

    if (!leadId || !eventData.action) {
      return NextResponse.json({ error: "leadId and action required" }, { status: 400 });
    }

    const event = { ts: new Date().toISOString(), ...eventData };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { events: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const events = Array.isArray(lead.events) ? [...lead.events, event] : [event];

    await prisma.lead.update({
      where: { id: leadId },
      data: { events },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
