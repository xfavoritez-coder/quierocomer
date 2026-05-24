import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const phone = req.nextUrl.searchParams.get("phone");

  try {
    if (phone) {
      const messages = await prisma.$queryRaw`
        SELECT id, direction, body, status, "profileName", "createdAt"
        FROM "WhatsAppMessage" WHERE phone = ${phone} ORDER BY "createdAt" ASC
      ` as any[];

      const lead = await prisma.lead.findFirst({
        where: { whatsapp: { contains: phone.replace("+", "") } },
        orderBy: { createdAt: "desc" },
        select: { localName: true, ownerName: true, generatedSlug: true },
      }).catch(() => null);

      let restaurant = null;
      if (lead?.generatedSlug) {
        restaurant = await prisma.restaurant.findFirst({
          where: { slug: lead.generatedSlug },
          select: { name: true, plan: true, isDemo: true },
        }).catch(() => null);
      }
      return NextResponse.json({ messages, lead, restaurant });
    }

    // List all conversations grouped by phone
    const allMessages = await prisma.$queryRaw`
      SELECT phone, direction, body, "profileName", "createdAt", "leadId"
      FROM "WhatsAppMessage" ORDER BY "createdAt" DESC
    ` as any[];

    const convMap = new Map<string, any>();
    for (const m of allMessages) {
      const existing = convMap.get(m.phone);
      if (!existing) {
        convMap.set(m.phone, {
          phone: m.phone, profileName: m.profileName || null,
          lastMessage: (m.body || "").slice(0, 60), lastAt: m.createdAt,
          count: 1, inbound: m.direction === "INBOUND" ? 1 : 0,
          outbound: m.direction === "OUTBOUND" ? 1 : 0, leadId: m.leadId,
        });
      } else {
        existing.count++;
        if (m.direction === "INBOUND") existing.inbound++;
        else existing.outbound++;
        if (m.profileName && !existing.profileName) existing.profileName = m.profileName;
      }
    }

    const conversations = await Promise.all([...convMap.values()].map(async (c) => {
      const lead = await prisma.lead.findFirst({
        where: { whatsapp: { contains: c.phone.replace("+", "") } },
        orderBy: { createdAt: "desc" },
        select: { localName: true, ownerName: true },
      }).catch(() => null);
      return { ...c, localName: lead?.localName || null, ownerName: lead?.ownerName || null };
    }));

    return NextResponse.json({ conversations });
  } catch (e: any) {
    console.error("[WA Conversations]", e?.message);
    return NextResponse.json({ conversations: [], error: e?.message }, { status: 200 });
  }
}
