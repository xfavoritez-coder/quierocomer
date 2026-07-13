import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

/**
 * Lazy-load detail data for a single lifecycle row (expanded view).
 * Called only when the user clicks to expand a row — not on initial page load.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Handle orphan leads (id = "lead-{leadId}")
  if (id.startsWith("lead-")) {
    const leadId = id.replace("lead-", "");
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { events: true, email: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

    const emailsSent = lead.email
      ? await prisma.emailLog.findMany({
          where: { to: lead.email, createdAt: { gte: ninetyDaysAgo } },
          select: { purpose: true, status: true, openedAt: true, clickedAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : [];

    return NextResponse.json({
      recentActivity: [],
      emailsSent: emailsSent.map(e => ({
        purpose: e.purpose, status: e.status,
        openedAt: e.openedAt?.toISOString() || null,
        clickedAt: e.clickedAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
      leadEvents: Array.isArray(lead.events) ? lead.events : [],
    });
  }

  // Regular restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { owner: { select: { email: true } }, slug: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  // Fetch lead for lead events
  const lead = restaurant.slug
    ? await prisma.lead.findFirst({
        where: { generatedSlug: restaurant.slug },
        select: { events: true },
      })
    : null;

  const [recentActivity, emailsSent] = await Promise.all([
    prisma.panelActivity.findMany({
      where: { restaurantId: id },
      select: { action: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    restaurant.owner?.email
      ? prisma.emailLog.findMany({
          where: { to: restaurant.owner.email, createdAt: { gte: ninetyDaysAgo } },
          select: { purpose: true, status: true, openedAt: true, clickedAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    recentActivity: recentActivity.map(a => ({
      action: a.action,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    })),
    emailsSent: emailsSent.map(e => ({
      purpose: e.purpose, status: e.status,
      openedAt: e.openedAt?.toISOString() || null,
      clickedAt: e.clickedAt?.toISOString() || null,
      createdAt: e.createdAt.toISOString(),
    })),
    leadEvents: Array.isArray(lead?.events) ? lead.events : [],
  });
}
