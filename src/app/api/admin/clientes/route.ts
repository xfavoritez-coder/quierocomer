import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

const PLAN_PRICES: Record<string, number> = { SILVER: 14900, GOLD: 29900, PREMIUM: 44900 };

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch leads first to get funnel slugs (skip Google Maps restaurants)
  const leads = await prisma.lead.findMany({
    where: { generatedSlug: { not: null } },
    select: {
      id: true, generatedSlug: true, localName: true, ownerName: true,
      email: true, whatsapp: true, cartaType: true, cartaUrl: true,
      cartaStatus: true, activated: true, activatedAt: true,
      completedAt: true, deliveredAt: true, emailOpenedAt: true, emailClickedAt: true,
      onboardingDoneAt: true, panelVisitedAt: true, activarVisitedAt: true,
      events: true, createdAt: true, ip: true, city: true,
    },
  });
  const funnelSlugs = leads.map((l) => l.generatedSlug).filter(Boolean) as string[];

  const [restaurants, recentActivity, adSessions, emailLogs] = await Promise.all([
    prisma.restaurant.findMany({
      where: { OR: [{ slug: { in: funnelSlugs } }, { ownerId: { not: null } }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, name: true, logoUrl: true,
        plan: true, subscriptionStatus: true, trialEndsAt: true,
        billingExempt: true, isDemo: true, isActive: true, menuImported: true,
        website: true, createdAt: true, updatedAt: true, ownerId: true,
        owner: { select: { id: true, name: true, email: true, whatsapp: true, lastLoginAt: true, updatedAt: true } },
        _count: { select: { dishes: true, sessions: true, categories: true } },
      },
    }),
    prisma.panelActivity.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { restaurantId: true, action: true, createdAt: true, details: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adSession.findMany({
      where: { leadId: { not: null } },
      select: {
        leadId: true, utmSource: true, utmMedium: true, utmCampaign: true,
        landingPage: true, referrer: true, device: true, duration: true,
        maxScroll: true, interactions: true, sectionsViewed: true, bounced: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailLog.findMany({
      where: { purpose: { in: ["activation_welcome", "funnel_carta_lista", "lead_failure_help"] } },
      select: { to: true, subject: true, purpose: true, status: true, openedAt: true, clickedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Build lookup maps
  const emailsByOwnerEmail = new Map<string, typeof emailLogs>();
  for (const e of emailLogs) {
    if (!emailsByOwnerEmail.has(e.to)) emailsByOwnerEmail.set(e.to, []);
    emailsByOwnerEmail.get(e.to)!.push(e);
  }

  const adSessionByLeadId = new Map<string, typeof adSessions[0]>();
  for (const s of adSessions) {
    if (s.leadId && !adSessionByLeadId.has(s.leadId)) adSessionByLeadId.set(s.leadId, s);
  }

  const leadBySlug = new Map<string, typeof leads[0]>();
  for (const l of leads) {
    if (l.generatedSlug) leadBySlug.set(l.generatedSlug, l);
  }

  const activityByRestaurant = new Map<string, typeof recentActivity>();
  for (const a of recentActivity) {
    if (!activityByRestaurant.has(a.restaurantId)) activityByRestaurant.set(a.restaurantId, []);
    activityByRestaurant.get(a.restaurantId)!.push(a);
  }

  // Count sessions in last 7 days per restaurant
  const recentSessions = await prisma.session.groupBy({
    by: ["restaurantId"],
    where: { startedAt: { gte: sevenDaysAgo } },
    _count: true,
  });
  const sessions7dMap = new Map<string, number>();
  for (const s of recentSessions) sessions7dMap.set(s.restaurantId, s._count);

  // Stats accumulators
  let total = 0, enTrial = 0, trialExpireThisWeek = 0, pagando = 0, mrr = 0, dormidos = 0;
  const totalLeadsCompleted = leads.filter(l => l.completedAt).length;
  const totalLeadsActivated = leads.filter(l => l.activated).length;

  // Build client list
  const clientes = restaurants.map(r => {
    const lead = leadBySlug.get(r.slug);
    const activity = activityByRestaurant.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;

    // Estado
    let estado: string;
    let trialDaysLeft: number | null = null;
    if (r.isDemo) {
      estado = "DEMO";
    } else if (r.billingExempt) {
      estado = "BONIFICADO";
    } else if (r.subscriptionStatus === "TRIALING" && r.trialEndsAt) {
      const daysLeft = Math.ceil((r.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft > 0) {
        estado = "TRIAL";
        trialDaysLeft = daysLeft;
      } else {
        estado = "TRIAL_VENCIDO";
      }
    } else if (r.subscriptionStatus === "ACTIVE") {
      estado = "ACTIVO";
    } else {
      estado = "FREE";
    }

    // Origen
    let origen: string;
    if (lead) {
      origen = "SUBIR_CARTA";
    } else if (r.ownerId) {
      origen = "PLANES";
    } else {
      origen = "HANDOFF";
    }

    // Salud — based on most recent activity signal
    const ownerLastActive = r.owner?.lastLoginAt || r.owner?.updatedAt;
    const lastActivityTime = activity[0]?.createdAt;
    const latestSignal = [ownerLastActive, lastActivityTime].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];

    let salud: string;
    if (!r.owner && !r.isDemo) {
      salud = "gray";
    } else if (!latestSignal) {
      salud = r.isDemo ? "gray" : "red";
    } else {
      const hoursAgo = (now.getTime() - latestSignal.getTime()) / (60 * 60 * 1000);
      salud = hoursAgo < 48 ? "green" : hoursAgo < 168 ? "yellow" : "red";
    }

    // Stats
    if (!r.isDemo) {
      total++;
      if (estado === "TRIAL") {
        enTrial++;
        if (r.trialEndsAt && r.trialEndsAt <= oneWeekFromNow) trialExpireThisWeek++;
      }
      if (estado === "ACTIVO" && !r.billingExempt) {
        pagando++;
        mrr += PLAN_PRICES[r.plan] || 0;
      }
      if (salud === "red") dormidos++;
    }

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoUrl,
      plan: r.plan,
      estado,
      trialDaysLeft,
      origen,
      salud,
      ultimaActividad: latestSignal?.toISOString() || null,
      owner: r.owner ? { name: r.owner.name, email: r.owner.email, whatsapp: r.owner.whatsapp } : null,
      ownerId: r.ownerId,
      dishes: r._count.dishes,
      categories: r._count.categories,
      sessions: r._count.sessions,
      sessions7d,
      menuImported: r.menuImported,
      billingExempt: r.billingExempt,
      isDemo: r.isDemo,
      createdAt: r.createdAt.toISOString(),
      leadId: lead?.id || null,
      leadEvents: lead ? (lead.events as any[]) || [] : [],
      leadTimeline: lead ? {
        cartaType: lead.cartaType,
        cartaUrl: lead.cartaUrl,
        city: lead.city,
        completedAt: lead.completedAt?.toISOString(),
        deliveredAt: lead.deliveredAt?.toISOString(),
        emailOpenedAt: lead.emailOpenedAt?.toISOString(),
        emailClickedAt: lead.emailClickedAt?.toISOString(),
        onboardingDoneAt: lead.onboardingDoneAt?.toISOString(),
        panelVisitedAt: lead.panelVisitedAt?.toISOString(),
        activarVisitedAt: lead.activarVisitedAt?.toISOString(),
        activatedAt: lead.activatedAt?.toISOString(),
      } : null,
      recentActivity: activity.slice(0, 15).map(a => ({
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        details: a.details,
      })),
      visitorSession: lead ? (() => {
        const vs = adSessionByLeadId.get(lead.id);
        return vs ? {
          utmSource: vs.utmSource, utmMedium: vs.utmMedium, utmCampaign: vs.utmCampaign,
          landingPage: vs.landingPage, referrer: vs.referrer, device: vs.device,
          duration: vs.duration, maxScroll: vs.maxScroll, interactions: vs.interactions,
          sectionsViewed: vs.sectionsViewed, bounced: vs.bounced,
          createdAt: vs.createdAt.toISOString(),
        } : null;
      })() : null,
      emailsSent: r.owner?.email ? (emailsByOwnerEmail.get(r.owner.email) || []).map(e => ({
        subject: e.subject, purpose: e.purpose, status: e.status,
        openedAt: e.openedAt?.toISOString() || null,
        clickedAt: e.clickedAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })) : [],
    };
  });

  const tasaActivacion = totalLeadsCompleted > 0 ? Math.round((totalLeadsActivated / totalLeadsCompleted) * 100) : 0;

  return NextResponse.json({
    clientes,
    stats: { total, enTrial, trialExpireThisWeek, pagando, mrr, dormidos, tasaActivacion },
  });
}
