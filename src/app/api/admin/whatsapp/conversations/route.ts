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
        select: { localName: true, ownerName: true, generatedSlug: true, events: true },
      }).catch(() => null);

      let restaurant = null;
      let insights: string[] = [];
      if (lead?.generatedSlug) {
        restaurant = await prisma.restaurant.findFirst({
          where: { slug: lead.generatedSlug },
          select: { name: true, plan: true, slug: true, isDemo: true, isActive: true, subscriptionStatus: true },
        }).catch(() => null);
      }

      // Extract insights from lead events
      if (lead?.events && Array.isArray(lead.events)) {
        for (const ev of lead.events as any[]) {
          if (ev.insight) insights.push(ev.insight);
        }
      }

      return NextResponse.json({ messages, lead, restaurant, insights });
    }

    // List all conversations grouped by phone
    const allMessages = await prisma.$queryRaw`
      SELECT phone, direction, body, "profileName", "createdAt", "leadId", "restaurantId"
      FROM "WhatsAppMessage" ORDER BY "createdAt" DESC
    ` as any[];

    const convMap = new Map<string, any>();
    for (const m of allMessages) {
      const existing = convMap.get(m.phone);
      if (!existing) {
        convMap.set(m.phone, {
          phone: m.phone, profileName: m.profileName || null,
          lastMessage: (m.body || "").slice(0, 80), lastAt: m.createdAt,
          count: 1, inbound: m.direction === "INBOUND" ? 1 : 0,
          outbound: m.direction === "OUTBOUND" ? 1 : 0,
          leadId: m.leadId, restaurantId: m.restaurantId,
          isCamila: m.direction === "OUTBOUND" && (m.body || "").includes("Camila"),
        });
      } else {
        existing.count++;
        if (m.direction === "INBOUND") existing.inbound++;
        else existing.outbound++;
        if (m.profileName && !existing.profileName) existing.profileName = m.profileName;
        if (m.direction === "OUTBOUND" && (m.body || "").includes("Camila")) existing.isCamila = true;
      }
    }

    // Enrich with lead + restaurant data
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const conversations = await Promise.all([...convMap.values()].map(async (c) => {
      const lead = await prisma.lead.findFirst({
        where: { whatsapp: { contains: c.phone.replace("+", "") } },
        orderBy: { createdAt: "desc" },
        select: { localName: true, ownerName: true, generatedSlug: true, events: true, activatedAt: true },
      }).catch(() => null);

      let restaurant = null;
      let sessions7d = 0;
      const slug = lead?.generatedSlug;
      if (slug) {
        restaurant = await prisma.restaurant.findFirst({
          where: { slug },
          select: { id: true, name: true, plan: true, isDemo: true, subscriptionStatus: true },
        }).catch(() => null);
        if (restaurant) {
          sessions7d = await prisma.session.count({
            where: { restaurantId: restaurant.id, startedAt: { gte: sevenDaysAgo } },
          });
        }
      }

      // Extract insights
      const insights: string[] = [];
      if (lead?.events && Array.isArray(lead.events)) {
        for (const ev of lead.events as any[]) {
          if (ev.insight) insights.push(ev.insight);
        }
      }

      // Determine mode
      const mode = sessions7d >= 50 ? "support" : "sales";

      // Has responded? (any inbound after an outbound)
      const responded = c.inbound > 0 && c.outbound > 0;

      return {
        ...c,
        localName: restaurant?.name || lead?.localName || null,
        ownerName: lead?.ownerName || null,
        plan: restaurant?.plan || null,
        isDemo: restaurant?.isDemo || false,
        subscriptionStatus: restaurant?.subscriptionStatus || null,
        activated: !!lead?.activatedAt,
        sessions7d,
        mode,
        insights,
        responded,
      };
    }));

    // Sort: responded first, then by lastAt
    conversations.sort((a, b) => {
      if (a.responded && !b.responded) return -1;
      if (!a.responded && b.responded) return 1;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });

    // Stats
    const totalConvs = conversations.length;
    const withResponse = conversations.filter(c => c.responded).length;
    const camilaSent = conversations.filter(c => c.isCamila).length;
    const totalInsights = conversations.reduce((sum, c) => sum + c.insights.length, 0);

    return NextResponse.json({
      conversations,
      stats: { totalConvs, withResponse, camilaSent, totalInsights },
    });
  } catch (e: any) {
    console.error("[WA Conversations]", e?.message);
    return NextResponse.json({ conversations: [], stats: {}, error: e?.message }, { status: 200 });
  }
}
