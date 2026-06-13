import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // 1. Get ALL leads with their full data
  const leads = await p.lead.findMany({
    orderBy: { createdAt: "asc" },
  });

  // 2. Get all restaurants that came from leads (by slug match or ownerId)
  const restaurants = await p.restaurant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      isActive: true,
      isDemo: true,
      demoOnboardingDone: true,
      menuImported: true,
      qrActivatedAt: true,
      trialEndsAt: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      showCategoryLobby: true,
      cartaTheme: true,
      cartaColorMode: true,
      defaultView: true,
      weeklyEmailEnabled: true,
      _count: {
        select: {
          categories: true,
          dishes: true,
          statEvents: true,
          promotions: true,
          campaigns: true,
        },
      },
    },
  });

  // 3. Get panel activity grouped by restaurant
  const activities = await p.panelActivity.findMany({
    select: {
      restaurantId: true,
      action: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // 4. Get stat events (QR scans) per restaurant
  const statEvents = await p.statEvent.groupBy({
    by: ["restaurantId"],
    _count: true,
  });

  // 5. Get session counts per restaurant (real QR users)
  const sessions = await p.session.groupBy({
    by: ["restaurantId"],
    _count: true,
  });

  // 6. Get email logs for lead-related emails
  const emailLogs = await p.emailLog.findMany({
    where: {
      purpose: {
        in: [
          "carta_lista",
          "lead_failure_help",
          "lead_failure_escalated",
          "activacion",
          "weekly",
          "trial_reminder",
        ],
      },
    },
    select: {
      to: true,
      purpose: true,
      status: true,
      openedAt: true,
      clickedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // 7. Get WhatsApp messages
  const waMessages = await p.whatsAppMessage.findMany({
    where: { leadId: { not: null } },
    select: {
      leadId: true,
      direction: true,
      status: true,
      createdAt: true,
    },
  });

  // Build lookup maps
  const actByRestaurant = new Map<string, typeof activities>();
  for (const a of activities) {
    if (!actByRestaurant.has(a.restaurantId)) actByRestaurant.set(a.restaurantId, []);
    actByRestaurant.get(a.restaurantId)!.push(a);
  }

  const statsByRestaurant = new Map<string, number>();
  for (const s of statEvents) statsByRestaurant.set(s.restaurantId, s._count);

  const sessionsByRestaurant = new Map<string, number>();
  for (const s of sessions) sessionsByRestaurant.set(s.restaurantId, s._count);

  const emailsByAddress = new Map<string, typeof emailLogs>();
  for (const e of emailLogs) {
    if (!emailsByAddress.has(e.to)) emailsByAddress.set(e.to, []);
    emailsByAddress.get(e.to)!.push(e);
  }

  const waByLead = new Map<string, typeof waMessages>();
  for (const w of waMessages) {
    if (!waByLead.has(w.leadId!)) waByLead.set(w.leadId!, []);
    waByLead.get(w.leadId!)!.push(w);
  }

  const restaurantBySlug = new Map<string, (typeof restaurants)[0]>();
  const restaurantByOwner = new Map<string, (typeof restaurants)[0]>();
  for (const r of restaurants) {
    if (r.slug) restaurantBySlug.set(r.slug, r);
    if (r.ownerId) restaurantByOwner.set(r.ownerId, r);
  }

  // ══════════════════════════════════════
  // ANALYZE EACH LEAD
  // ══════════════════════════════════════

  interface LeadAnalysis {
    id: string;
    localName: string;
    ownerName: string;
    email: string;
    whatsapp: string | null;
    createdAt: Date;
    daysSinceCreation: number;

    // Funnel steps
    cartaStatus: string;
    cartaType: string;
    step2Reached: boolean;
    formCompleted: boolean;
    previewGenerated: boolean;
    cartaReady: boolean;
    emailDelivered: boolean;
    emailOpened: boolean;
    emailClicked: boolean;
    onboardingDone: boolean;
    panelVisited: boolean;
    activarVisited: boolean;
    activated: boolean;

    // WhatsApp
    waSent: boolean;
    waOpened: boolean;
    waClicked: boolean;
    openedVia: string | null;

    // Restaurant data (if created)
    hasRestaurant: boolean;
    restaurantSlug: string | null;
    plan: string | null;
    subscriptionStatus: string | null;
    isDemo: boolean;
    dishCount: number;
    categoryCount: number;
    statEventCount: number;
    sessionCount: number;
    promoCount: number;

    // Panel engagement
    panelActions: number;
    uniquePanelActions: string[];
    lastPanelAction: Date | null;
    daysSinceLastPanelAction: number | null;

    // Emails
    emailsSent: number;
    emailsOpened: number;
    emailsClicked: number;

    // Lead events
    events: any[];

    // Classification
    segment: string;
    subSegment: string;
  }

  const now = new Date();
  const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);

  const analyzed: LeadAnalysis[] = [];

  for (const lead of leads) {
    const restaurant = lead.generatedSlug
      ? restaurantBySlug.get(lead.generatedSlug)
      : lead.convertedToOwnerId
        ? restaurantByOwner.get(lead.convertedToOwnerId)
        : undefined;

    const panelActs = restaurant ? actByRestaurant.get(restaurant.id) || [] : [];
    const emails = emailsByAddress.get(lead.email) || [];
    const wa = waByLead.get(lead.id) || [];

    const uniqueActions = [...new Set(panelActs.map((a) => a.action))];
    const lastAction = panelActs.length ? panelActs[panelActs.length - 1].createdAt : null;

    const entry: LeadAnalysis = {
      id: lead.id,
      localName: lead.localName,
      ownerName: lead.ownerName,
      email: lead.email,
      whatsapp: lead.whatsapp,
      createdAt: lead.createdAt,
      daysSinceCreation: daysBetween(lead.createdAt, now),

      cartaStatus: lead.cartaStatus,
      cartaType: lead.cartaType,
      step2Reached: !!lead.step2At,
      formCompleted: !!lead.completedAt,
      previewGenerated: !!lead.previewAt,
      cartaReady: !!lead.readyAt,
      emailDelivered: !!lead.deliveredAt,
      emailOpened: !!lead.emailOpenedAt,
      emailClicked: !!lead.emailClickedAt,
      onboardingDone: !!lead.onboardingDoneAt,
      panelVisited: !!lead.panelVisitedAt,
      activarVisited: !!lead.activarVisitedAt,
      activated: !!lead.activatedAt,

      waSent: !!lead.whatsappSentAt,
      waOpened: !!lead.whatsappOpenedAt,
      waClicked: !!lead.whatsappClickedAt,
      openedVia: lead.openedVia,

      hasRestaurant: !!restaurant,
      restaurantSlug: restaurant?.slug || null,
      plan: restaurant?.plan || null,
      subscriptionStatus: restaurant?.subscriptionStatus || null,
      isDemo: restaurant?.isDemo ?? true,
      dishCount: restaurant?._count.dishes || 0,
      categoryCount: restaurant?._count.categories || 0,
      statEventCount: restaurant ? statsByRestaurant.get(restaurant.id) || 0 : 0,
      sessionCount: restaurant ? sessionsByRestaurant.get(restaurant.id) || 0 : 0,
      promoCount: restaurant?._count.promotions || 0,

      panelActions: panelActs.length,
      uniquePanelActions: uniqueActions,
      lastPanelAction: lastAction,
      daysSinceLastPanelAction: lastAction ? daysBetween(lastAction, now) : null,

      emailsSent: emails.length,
      emailsOpened: emails.filter((e) => e.openedAt).length,
      emailsClicked: emails.filter((e) => e.clickedAt).length,

      events: (lead.events as any[]) || [],

      segment: "",
      subSegment: "",
    };

    // ══════════════════════════════════════
    // SEGMENTATION LOGIC
    // ══════════════════════════════════════

    if (lead.cartaStatus === "FAILED") {
      entry.segment = "FAILED";
      entry.subSegment = lead.emailOpenedAt
        ? "failed_opened_email"
        : "failed_no_response";
    } else if (lead.cartaStatus === "PENDING" || lead.cartaStatus === "PROCESSING") {
      entry.segment = "STUCK";
      entry.subSegment = "processing_stuck";
    } else if (!lead.readyAt) {
      entry.segment = "INCOMPLETE";
      entry.subSegment = !lead.step2At
        ? "abandoned_step1"
        : !lead.completedAt
          ? "abandoned_step2"
          : "waiting_processing";
    } else if (!lead.emailOpenedAt && !lead.whatsappClickedAt) {
      entry.segment = "NO_OPEN";
      entry.subSegment = lead.emailBouncedAt
        ? "email_bounced"
        : "never_opened";
    } else if (!lead.onboardingDoneAt && !lead.panelVisitedAt) {
      entry.segment = "OPENED_NO_ACTION";
      entry.subSegment = lead.emailClickedAt || lead.whatsappClickedAt
        ? "clicked_but_no_onboarding"
        : "opened_but_no_click";
    } else if (!lead.activatedAt) {
      // Has done onboarding or visited panel but not activated
      if (entry.panelActions > 10) {
        entry.segment = "ENGAGED_NOT_ACTIVATED";
        entry.subSegment = lead.activarVisitedAt
          ? "visited_activar_no_pay"
          : "active_panel_no_activar";
      } else if (entry.panelActions > 0) {
        entry.segment = "TRIED_NOT_ACTIVATED";
        entry.subSegment = lead.activarVisitedAt
          ? "light_use_saw_activar"
          : "light_use_no_activar";
      } else {
        entry.segment = "ONBOARDED_GHOST";
        entry.subSegment = lead.onboardingDoneAt
          ? "completed_onboarding_vanished"
          : "panel_visit_only";
      }
    } else {
      // ACTIVATED
      if (restaurant?.subscriptionStatus === "CANCELED" || restaurant?.subscriptionStatus === "UNPAID") {
        entry.segment = "CHURNED";
        entry.subSegment = entry.statEventCount > 50
          ? "churned_had_usage"
          : "churned_low_usage";
      } else if (entry.statEventCount === 0 && entry.sessionCount === 0) {
        entry.segment = "ACTIVATED_UNUSED";
        entry.subSegment = entry.panelActions > 5
          ? "setup_but_no_scans"
          : "activated_abandoned";
      } else if (entry.statEventCount < 20) {
        entry.segment = "ACTIVATED_LOW_USE";
        entry.subSegment = entry.daysSinceLastPanelAction && entry.daysSinceLastPanelAction > 14
          ? "dormant_after_trial"
          : "still_warming_up";
      } else {
        entry.segment = "ACTIVE";
        entry.subSegment = entry.statEventCount > 200
          ? "power_user"
          : "regular_user";
      }
    }

    analyzed.push(entry);
  }

  // ══════════════════════════════════════
  // OUTPUT: SUMMARY STATS
  // ══════════════════════════════════════

  console.log("\n" + "═".repeat(80));
  console.log("  ANALISIS PROFUNDO DE LEADS - QuieroComer");
  console.log("  Fecha:", now.toISOString().slice(0, 10));
  console.log("  Total leads:", analyzed.length);
  console.log("═".repeat(80));

  // Funnel overview
  const total = analyzed.length;
  const funnelSteps = [
    ["Leads creados", total],
    ["Paso 2 alcanzado", analyzed.filter((l) => l.step2Reached).length],
    ["Formulario completado", analyzed.filter((l) => l.formCompleted).length],
    ["Carta procesada (READY)", analyzed.filter((l) => l.cartaReady).length],
    ["Email entregado", analyzed.filter((l) => l.emailDelivered).length],
    ["Email abierto", analyzed.filter((l) => l.emailOpened).length],
    ["Email clickeado", analyzed.filter((l) => l.emailClicked).length],
    ["Onboarding completado", analyzed.filter((l) => l.onboardingDone).length],
    ["Panel visitado", analyzed.filter((l) => l.panelVisited).length],
    ["/activar visitado", analyzed.filter((l) => l.activarVisited).length],
    ["ACTIVADOS", analyzed.filter((l) => l.activated).length],
  ] as const;

  console.log("\n── FUNNEL COMPLETO ──");
  let prevCount = total;
  for (const [label, count] of funnelSteps) {
    const pctTotal = ((count as number / total) * 100).toFixed(1);
    const dropoff = prevCount > 0 ? (((prevCount - (count as number)) / prevCount) * 100).toFixed(1) : "0";
    console.log(
      `  ${String(count).padStart(4)}  (${pctTotal.padStart(5)}%)  drop ${dropoff.padStart(5)}%  ${label}`,
    );
    prevCount = count as number;
  }

  // WhatsApp funnel
  console.log("\n── WHATSAPP FUNNEL ──");
  const waSent = analyzed.filter((l) => l.waSent).length;
  const waOpened = analyzed.filter((l) => l.waOpened).length;
  const waClicked = analyzed.filter((l) => l.waClicked).length;
  console.log(`  WA enviados: ${waSent}  |  Abiertos: ${waOpened}  |  Clickeados: ${waClicked}`);
  const viaEmail = analyzed.filter((l) => l.openedVia === "email").length;
  const viaWA = analyzed.filter((l) => l.openedVia === "whatsapp").length;
  console.log(`  Abrieron via email: ${viaEmail}  |  via WhatsApp: ${viaWA}`);

  // Segment distribution
  console.log("\n── SEGMENTOS ──");
  const segmentCounts = new Map<string, number>();
  const subSegmentCounts = new Map<string, number>();
  for (const l of analyzed) {
    segmentCounts.set(l.segment, (segmentCounts.get(l.segment) || 0) + 1);
    const key = `${l.segment} > ${l.subSegment}`;
    subSegmentCounts.set(key, (subSegmentCounts.get(key) || 0) + 1);
  }

  const segmentOrder = [
    "FAILED",
    "STUCK",
    "INCOMPLETE",
    "NO_OPEN",
    "OPENED_NO_ACTION",
    "ONBOARDED_GHOST",
    "TRIED_NOT_ACTIVATED",
    "ENGAGED_NOT_ACTIVATED",
    "ACTIVATED_UNUSED",
    "ACTIVATED_LOW_USE",
    "CHURNED",
    "ACTIVE",
  ];

  for (const seg of segmentOrder) {
    const count = segmentCounts.get(seg) || 0;
    if (count === 0) continue;
    console.log(`\n  ${seg}: ${count} (${((count / total) * 100).toFixed(1)}%)`);
    for (const [sub, subCount] of [...subSegmentCounts.entries()]
      .filter(([k]) => k.startsWith(seg + " > "))
      .sort((a, b) => b[1] - a[1])) {
      const subLabel = sub.split(" > ")[1];
      console.log(`    └─ ${subLabel}: ${subCount}`);
    }
  }

  // ══════════════════════════════════════
  // DETAILED LIST PER SEGMENT
  // ══════════════════════════════════════

  console.log("\n\n" + "═".repeat(80));
  console.log("  DETALLE POR SEGMENTO");
  console.log("═".repeat(80));

  for (const seg of segmentOrder) {
    const segLeads = analyzed.filter((l) => l.segment === seg);
    if (segLeads.length === 0) continue;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  ${seg} (${segLeads.length} leads)`);
    console.log(`${"─".repeat(60)}`);

    for (const l of segLeads) {
      console.log(`\n  📍 ${l.localName}`);
      console.log(`     Owner: ${l.ownerName} | Email: ${l.email}${l.whatsapp ? ` | WA: ${l.whatsapp}` : ""}`);
      console.log(`     Creado: ${l.createdAt.toISOString().slice(0, 10)} (hace ${l.daysSinceCreation} días)`);
      console.log(`     SubSegmento: ${l.subSegment}`);
      console.log(`     Carta: ${l.cartaType} | Status: ${l.cartaStatus}`);

      // Funnel progress
      const steps = [];
      if (l.step2Reached) steps.push("step2");
      if (l.formCompleted) steps.push("form");
      if (l.previewGenerated) steps.push("preview");
      if (l.cartaReady) steps.push("ready");
      if (l.emailDelivered) steps.push("email_sent");
      if (l.emailOpened) steps.push("email_open");
      if (l.emailClicked) steps.push("email_click");
      if (l.onboardingDone) steps.push("onboarding");
      if (l.panelVisited) steps.push("panel");
      if (l.activarVisited) steps.push("activar");
      if (l.activated) steps.push("ACTIVATED");
      console.log(`     Funnel: ${steps.join(" → ") || "ningún paso"}`);

      // WA info
      if (l.waSent) {
        console.log(`     WA: sent${l.waOpened ? " → opened" : ""}${l.waClicked ? " → clicked" : ""}`);
      }

      if (l.hasRestaurant) {
        console.log(`     Restaurant: /${l.restaurantSlug} | Plan: ${l.plan} | Status: ${l.subscriptionStatus}`);
        console.log(`     Contenido: ${l.categoryCount} cats, ${l.dishCount} platos, ${l.promoCount} promos`);
        console.log(`     Uso QR: ${l.statEventCount} eventos, ${l.sessionCount} sesiones`);
        console.log(`     Panel: ${l.panelActions} acciones${l.lastPanelAction ? ` (última: hace ${l.daysSinceLastPanelAction} días)` : ""}`);
        if (l.uniquePanelActions.length > 0) {
          console.log(`     Acciones: ${l.uniquePanelActions.join(", ")}`);
        }
      }

      if (l.emailsSent > 0) {
        console.log(`     Emails: ${l.emailsSent} enviados, ${l.emailsOpened} abiertos, ${l.emailsClicked} clickeados`);
      }

      if (l.events.length > 0) {
        console.log(`     Eventos: ${l.events.map((e: any) => e.action || JSON.stringify(e)).join(", ")}`);
      }
    }
  }

  // ══════════════════════════════════════
  // TIME ANALYSIS
  // ══════════════════════════════════════

  console.log("\n\n" + "═".repeat(80));
  console.log("  ANALISIS TEMPORAL");
  console.log("═".repeat(80));

  // Leads per week
  const weekBuckets = new Map<string, { total: number; activated: number; ready: number }>();
  for (const l of analyzed) {
    const d = l.createdAt;
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekBuckets.has(key)) weekBuckets.set(key, { total: 0, activated: 0, ready: 0 });
    const b = weekBuckets.get(key)!;
    b.total++;
    if (l.activated) b.activated++;
    if (l.cartaReady) b.ready++;
  }

  console.log("\n── LEADS POR SEMANA ──");
  for (const [week, data] of [...weekBuckets.entries()].sort()) {
    console.log(
      `  ${week}: ${data.total} leads, ${data.ready} ready, ${data.activated} activated (${data.total > 0 ? ((data.activated / data.total) * 100).toFixed(0) : 0}%)`,
    );
  }

  // Time between steps (for those who completed)
  const readyLeads = analyzed.filter((l) => l.cartaReady);
  const activatedLeads = analyzed.filter((l) => l.activated);

  console.log("\n── TIEMPOS PROMEDIO (leads que completaron) ──");
  if (readyLeads.length > 0) {
    // Time from creation to ready
    const createdToReady = leads
      .filter((l) => l.readyAt)
      .map((l) => daysBetween(l.createdAt, l.readyAt!));
    if (createdToReady.length > 0) {
      const avg = createdToReady.reduce((a, b) => a + b, 0) / createdToReady.length;
      console.log(`  Creación → Ready: promedio ${avg.toFixed(1)} días (n=${createdToReady.length})`);
    }
  }

  if (activatedLeads.length > 0) {
    const readyToActivated = leads
      .filter((l) => l.readyAt && l.activatedAt)
      .map((l) => daysBetween(l.readyAt!, l.activatedAt!));
    if (readyToActivated.length > 0) {
      const avg = readyToActivated.reduce((a, b) => a + b, 0) / readyToActivated.length;
      console.log(`  Ready → Activado: promedio ${avg.toFixed(1)} días (n=${readyToActivated.length})`);
    }
  }

  // Carta type distribution
  console.log("\n── TIPO DE CARTA ──");
  const typeCount = new Map<string, { total: number; activated: number }>();
  for (const l of analyzed) {
    if (!typeCount.has(l.cartaType)) typeCount.set(l.cartaType, { total: 0, activated: 0 });
    const t = typeCount.get(l.cartaType)!;
    t.total++;
    if (l.activated) t.activated++;
  }
  for (const [type, data] of typeCount) {
    console.log(`  ${type}: ${data.total} leads, ${data.activated} activated (${((data.activated / data.total) * 100).toFixed(0)}%)`);
  }

  // City distribution
  console.log("\n── CIUDADES ──");
  const cityCount = new Map<string, number>();
  for (const l of leads) {
    const city = l.city || "desconocida";
    cityCount.set(city, (cityCount.get(city) || 0) + 1);
  }
  for (const [city, count] of [...cityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${city}: ${count}`);
  }

  await p.$disconnect();
}

main().catch(console.error);
