import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import {
  computeLifecycleStage,
  computeEngagementScore,
  OWNER_ACTIONS,
  type LifecycleStage,
} from "@/lib/admin/lifecycle";

// In-memory cache — valid for 3 minutes, survives within same serverless instance
let _cache: { entries: any[]; stats: any; ts: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const bust = url.searchParams.get("bust") === "1";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  // Serve from cache if available and not busting
  if (!bust && _cache && Date.now() - _cache.ts < CACHE_TTL) {
    const slice = _cache.entries.slice(offset, offset + limit);
    return NextResponse.json({
      entries: slice,
      stats: _cache.stats,
      total: _cache.entries.length,
      page,
      hasMore: offset + limit < _cache.entries.length,
      cached: true,
    });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // ── Phase 1: leads + restaurants (base data) ──
  const [leads, restaurants] = await Promise.all([
    prisma.lead.findMany({
      where: { generatedSlug: { not: null } },
      select: {
        id: true, generatedSlug: true, localName: true, ownerName: true,
        email: true, whatsapp: true, cartaStatus: true, cartaType: true, cartaUrl: true, cartaFileUrl: true,
        activated: true, activatedAt: true, deliveredAt: true,
        emailClickedAt: true, whatsappClickedAt: true,
        emailOpenedAt: true, completedAt: true,
        events: true, createdAt: true,
      },
    }),
    // Todos los restaurantes con owner (no solo funnel)
    prisma.restaurant.findMany({
      where: { ownerId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, name: true, logoUrl: true,
        plan: true, subscriptionStatus: true, trialEndsAt: true,
        billingExempt: true, isDemo: true, createdAt: true, ownerId: true,
        mpPayerEmail: true, currentPeriodEnd: true, lastPaymentAt: true,
        owner: { select: { id: true, name: true, email: true, whatsapp: true, lastLoginAt: true } },
        _count: { select: { dishes: true, sessions: true, categories: true } },
      },
    }),
  ]);

  // ── Phase 2: all secondary queries scoped to owned restaurant IDs ──
  const restaurantIds = restaurants.map(r => r.id);

  // Only fetch the specific actions needed for stage/salud/engagement — not ALL activity
  const OWNER_ACTIONS_ARRAY = [...OWNER_ACTIONS];

  const [allActivity, sessions7dGroups, dishesWithPhotos, clientCounts] = await Promise.all([
    // Only owner-relevant actions + nurturing — drastically smaller than "all activity"
    prisma.panelActivity.findMany({
      where: {
        restaurantId: { in: restaurantIds },
        createdAt: { gte: sixtyDaysAgo },
        OR: [
          { action: { in: OWNER_ACTIONS_ARRAY } },
          { action: { startsWith: "nurturing_" } },
        ],
      },
      select: { restaurantId: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // Sessions last 7 days — solo restaurantes con owner
    prisma.session.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: restaurantIds }, startedAt: { gte: sevenDaysAgo } },
      _count: true,
    }),
    // Restaurants that have at least 1 dish with photos — solo restaurantes con owner
    prisma.dish.findMany({
      where: { restaurantId: { in: restaurantIds }, photos: { isEmpty: false }, deletedAt: null },
      select: { restaurantId: true },
      distinct: ["restaurantId"],
    }),
    // RestaurantClient counts per restaurant — solo restaurantes con owner
    prisma.restaurantClient.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: restaurantIds } },
      _count: true,
    }),
  ]);

  // ── Build lookup maps ──
  const leadBySlug = new Map<string, typeof leads[0]>();
  for (const l of leads) {
    if (l.generatedSlug) leadBySlug.set(l.generatedSlug, l);
  }

  // Activity grouped by restaurant
  const activityByRest = new Map<string, typeof allActivity>();
  for (const a of allActivity) {
    if (!activityByRest.has(a.restaurantId)) activityByRest.set(a.restaurantId, []);
    activityByRest.get(a.restaurantId)!.push(a);
  }

  const sessions7dMap = new Map<string, number>();
  for (const s of sessions7dGroups) sessions7dMap.set(s.restaurantId, s._count);

  const hasPhotosSet = new Set(dishesWithPhotos.map(d => d.restaurantId));

  const clientCountMap = new Map<string, number>();
  for (const c of clientCounts) clientCountMap.set(c.restaurantId, c._count);


  // ── Process each restaurant ──
  const stageCounts: Record<string, number> = {};
  let totalActivated = 0;
  let totalLeadsCompleted = 0;

  const entries = restaurants.map(r => {
    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;
    const totalSessions = r._count.sessions;

    // Find last OWNER-initiated activity
    const lastOwnerAct = activity.find(a => OWNER_ACTIONS.has(a.action));

    // Check which nurturing messages were already sent
    const nurturingSent = activity
      .filter(a => a.action.startsWith("nurturing_"))
      .map(a => ({ action: a.action, date: a.createdAt.toISOString() }));

    // Compute lifecycle stage
    const stage = computeLifecycleStage({
      restaurant: {
        isDemo: r.isDemo,
        plan: r.plan,
        subscriptionStatus: r.subscriptionStatus,
        trialEndsAt: r.trialEndsAt,
        billingExempt: r.billingExempt,
        ownerLastLoginAt: r.owner?.lastLoginAt || null,
        hasOwner: !!r.owner,
      },
      lead: lead ? {
        cartaStatus: lead.cartaStatus,
        emailClickedAt: lead.emailClickedAt,
        whatsappClickedAt: lead.whatsappClickedAt,
        activated: lead.activated,
      } : null,
      lastOwnerActivity: lastOwnerAct?.createdAt || null,
      sessions7d,
    }, now);

    // Compute engagement score
    const hasEditedDish = activity.some(a => a.action === "dish_edit");
    const hasUploadedPhoto = hasPhotosSet.has(r.id);
    const hasClients = (clientCountMap.get(r.id) || 0) > 0;

    const { score: engagement, checks: engagementChecks } = computeEngagementScore({
      hasDishes: r._count.dishes > 0,
      viewedCarta: !!(lead?.emailClickedAt || lead?.whatsappClickedAt),
      activated: !r.isDemo,
      editedDish: hasEditedDish,
      uploadedPhoto: hasUploadedPhoto,
      hasVisitorSessions: totalSessions > 0,
      has10PlusSessions: totalSessions >= 10,
      hasRegisteredClients: hasClients,
      loggedInToPanel: !!r.owner?.lastLoginAt,
      madePayment: r.subscriptionStatus === "ACTIVE",
    });

    // Health (salud)
    const latestSignal = [r.owner?.lastLoginAt, lastOwnerAct?.createdAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
    let salud: string;
    if (!r.owner && !r.isDemo) {
      salud = "gray";
    } else if (!latestSignal) {
      salud = r.isDemo ? "gray" : "red";
    } else {
      const hoursAgo = (now.getTime() - latestSignal.getTime()) / (60 * 60 * 1000);
      salud = hoursAgo < 48 ? "green" : hoursAgo < 168 ? "yellow" : "red";
    }

    // Trial days left
    let trialDaysLeft: number | null = null;
    if (r.subscriptionStatus === "TRIALING" && r.trialEndsAt) {
      trialDaysLeft = Math.max(0, Math.ceil((r.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    }

    // Stats accumulation
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    if (lead?.completedAt) totalLeadsCompleted++;
    if (lead?.activated) totalActivated++;

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoUrl,
      plan: r.plan,
      stage,
      engagement,
      engagementChecks,
      salud,
      trialDaysLeft,
      lastActivity: latestSignal?.toISOString() || null,
      sessions7d,
      totalSessions,
      dishes: r._count.dishes,
      categories: r._count.categories,
      createdAt: r.createdAt.toISOString(),
      owner: r.owner ? { name: r.owner.name, email: r.owner.email, whatsapp: r.owner.whatsapp } : null,
      // Lead info for detail view
      leadId: lead?.id || null,
      leadOwner: lead?.ownerName || null,
      leadEmail: lead?.email || null,
      leadWhatsapp: lead?.whatsapp || null,
      cartaOriginalUrl: lead?.cartaFileUrl || lead?.cartaUrl || null,
      cartaType: lead?.cartaType || null,
      leadCreatedAt: lead?.createdAt?.toISOString() || null,
      nurturingSent,
      billingExempt: r.billingExempt,
      subscriptionStatus: r.subscriptionStatus,
      mpPayerEmail: r.mpPayerEmail || null,
      currentPeriodEnd: r.currentPeriodEnd?.toISOString() || null,
      lastPaymentAt: r.lastPaymentAt?.toISOString() || null,
      ownerId: r.ownerId,
      // Lead timeline
      leadTimeline: lead ? {
        deliveredAt: lead.deliveredAt?.toISOString() || null,
        emailOpenedAt: lead.emailOpenedAt?.toISOString() || null,
        emailClickedAt: lead.emailClickedAt?.toISOString() || null,
        activatedAt: lead.activatedAt?.toISOString() || null,
      } : null,
    };
  });

  // ── Add orphan leads (no matching restaurant) ──
  const usedSlugs = new Set(restaurants.map(r => r.slug));
  for (const lead of leads) {
    if (!lead.generatedSlug || usedSlugs.has(lead.generatedSlug)) continue;

    const stage = computeLifecycleStage({
      restaurant: null,
      lead: {
        cartaStatus: lead.cartaStatus,
        emailClickedAt: lead.emailClickedAt,
        whatsappClickedAt: lead.whatsappClickedAt,
        activated: lead.activated,
      },
      lastOwnerActivity: null,
      sessions7d: 0,
    }, now);

    const { score: engagement, checks: engagementChecks } = computeEngagementScore({
      hasDishes: false, viewedCarta: !!(lead.emailClickedAt || lead.whatsappClickedAt),
      activated: false, editedDish: false, uploadedPhoto: false,
      hasVisitorSessions: false, has10PlusSessions: false, hasRegisteredClients: false,
      loggedInToPanel: false, madePayment: false,
    });

    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    if (lead.completedAt) totalLeadsCompleted++;

    entries.push({
      id: `lead-${lead.id}`,
      slug: lead.generatedSlug,
      name: lead.localName || "Sin nombre",
      logoUrl: null,
      plan: "FREE" as any,
      stage,
      engagement,
      engagementChecks,
      salud: "gray",
      trialDaysLeft: null,
      lastActivity: null,
      sessions7d: 0,
      totalSessions: 0,
      dishes: 0,
      categories: 0,
      createdAt: lead.createdAt.toISOString(),
      owner: null,
      leadId: lead.id,
      leadOwner: lead.ownerName,
      leadEmail: lead.email,
      leadWhatsapp: lead.whatsapp,
      cartaOriginalUrl: lead.cartaFileUrl || lead.cartaUrl || null,
      cartaType: lead.cartaType || null,
      leadCreatedAt: lead.createdAt.toISOString(),
      billingExempt: false,
      subscriptionStatus: "NONE",
      mpPayerEmail: null,
      currentPeriodEnd: null,
      lastPaymentAt: null,
      nurturingSent: [],
      ownerId: null,
      leadTimeline: {
        deliveredAt: null,
        emailOpenedAt: null,
        emailClickedAt: null,
        activatedAt: null,
      },
    });
  }

  // ── Stats ──
  const tasaActivacion = totalLeadsCompleted > 0 ? Math.round((totalActivated / totalLeadsCompleted) * 100) : 0;

  const stats = {
    total: entries.length,
    leads: (stageCounts.LEAD_PROCESANDO || 0) + (stageCounts.LEAD_FALLIDO || 0) + (stageCounts.LEAD_NO_VIO || 0) + (stageCounts.LEAD_VIO_NO_ACTIVO || 0),
    enTrial: (stageCounts.TRIAL_USANDO || 0) + (stageCounts.TRIAL_ACTIVO || 0) + (stageCounts.TRIAL_DORMIDO || 0),
    activos: (stageCounts.ACTIVO || 0) + (stageCounts.BONIFICADO || 0),
    dormidos: (stageCounts.DORMIDO || 0) + (stageCounts.ACTIVADO_SIN_USO || 0) + (stageCounts.TRIAL_DORMIDO || 0),
    vencidos: stageCounts.TRIAL_VENCIDO || 0,
    tasaActivacion,
    stageCounts,
  };

  // Default sort: lastActivity desc (most recently active first)
  entries.sort((a, b) => {
    const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return tb - ta;
  });

  // Cache full result
  _cache = { entries, stats, ts: Date.now() };

  const slice = entries.slice(offset, offset + limit);
  return NextResponse.json({
    entries: slice,
    stats,
    total: entries.length,
    page,
    hasMore: offset + limit < entries.length,
  });
}
