import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const phone = req.nextUrl.searchParams.get("phone");

  // Single conversation thread
  if (phone) {
    const messages = await (prisma as any).whatsAppMessage.findMany({
      where: { phone },
      orderBy: { createdAt: "asc" },
      select: { id: true, direction: true, body: true, status: true, profileName: true, createdAt: true },
    });
    // Get linked context
    const lead = await prisma.lead.findFirst({
      where: { whatsapp: { contains: phone.replace("+", "") } },
      orderBy: { createdAt: "desc" },
      select: { localName: true, ownerName: true, generatedSlug: true },
    });
    let restaurant = null;
    if (lead?.generatedSlug) {
      restaurant = await prisma.restaurant.findFirst({
        where: { slug: lead.generatedSlug },
        select: { name: true, plan: true, isDemo: true },
      });
    }
    return NextResponse.json({ messages, lead, restaurant });
  }

  // List all conversations
  const allMessages = await (prisma as any).whatsAppMessage.findMany({
    orderBy: { createdAt: "desc" },
    select: { phone: true, direction: true, body: true, profileName: true, createdAt: true, leadId: true },
  });

  // Group by phone
  const convMap = new Map<string, { phone: string; profileName: string | null; lastMessage: string; lastAt: Date; count: number; inbound: number; outbound: number; leadId: string | null }>();
  for (const m of allMessages) {
    const existing = convMap.get(m.phone);
    if (!existing) {
      convMap.set(m.phone, {
        phone: m.phone,
        profileName: m.profileName || null,
        lastMessage: m.body.slice(0, 60),
        lastAt: m.createdAt,
        count: 1,
        inbound: m.direction === "INBOUND" ? 1 : 0,
        outbound: m.direction === "OUTBOUND" ? 1 : 0,
        leadId: m.leadId,
      });
    } else {
      existing.count++;
      if (m.direction === "INBOUND") existing.inbound++;
      else existing.outbound++;
      if (m.profileName && !existing.profileName) existing.profileName = m.profileName;
    }
  }

  // Enrich with lead/restaurant info
  const conversations = await Promise.all([...convMap.values()].map(async (c) => {
    const lead = await prisma.lead.findFirst({
      where: { whatsapp: { contains: c.phone.replace("+", "") } },
      orderBy: { createdAt: "desc" },
      select: { localName: true, ownerName: true },
    });
    return { ...c, localName: lead?.localName || null, ownerName: lead?.ownerName || null };
  }));

  return NextResponse.json({ conversations });
}
