import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getExperimentVariantsWithStats } from "@/lib/ab/getExperimentStats";
import { sampleBeta } from "@/lib/ab/sampling";

const EXPERIMENTS: { slug: string; impressionEvent: string; conversionEvent: string; deepConversionEvent?: string }[] = [
  { slug: "birthday-modal", impressionEvent: "BIRTHDAY_MODAL_AUTO_SHOWN", conversionEvent: "BIRTHDAY_SAVED" },
  { slug: "landing-hero", impressionEvent: "LANDING_VIEWED", conversionEvent: "LANDING_CTA_CLICK", deepConversionEvent: "LANDING_LEAD_CREATED" },
  { slug: "subircarta-hero", impressionEvent: "SUBIRCARTA_VIEWED", conversionEvent: "SUBIRCARTA_CARTA_UPLOADED" },
];

/**
 * Lists every A/B experiment with per-variant stats and the current
 * Thompson Sampling traffic share (estimated by sampling the posterior
 * many times — roughly = "what % of impressions would each variant get
 * right now if we ran a million samples"). Owners use this to see which
 * options are pulling ahead in real time.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const out = [];
  for (const expCfg of EXPERIMENTS) {
    try {
    const { experiment, variants } = await getExperimentVariantsWithStats(
      expCfg.slug,
      expCfg.impressionEvent,
      expCfg.conversionEvent,
    );
    if (!experiment) continue;

    // Deep conversions (leads created from landing)
    const deepConversionEvent = expCfg.deepConversionEvent;
    let deepStats: Map<string, number> | null = null;
    if (deepConversionEvent) {
      deepStats = new Map();
      const deepEvents = await prisma.statEvent.findMany({
        where: { eventType: deepConversionEvent as any, metadata: { path: ["abExperiment"], equals: expCfg.slug } },
        select: { metadata: true },
      });
      for (const e of deepEvents) {
        const m = e.metadata as any;
        if (!m) continue;
        for (const slot of ["title", "subtitle", "cta"]) {
          const id = m[`${slot}Id`];
          if (id) deepStats.set(id, (deepStats.get(id) || 0) + 1);
        }
      }
    }

    const slots = ["title", "subtitle", "cta"] as const;
    const slotData: Record<string, any> = {};
    for (const slot of slots) {
      const slotVariants = variants.filter((v) => v.slot === slot);
      const activeVariants = slotVariants.filter((v) => v.isActive);

      // Estimate Thompson Sampling traffic share with N posterior samples.
      const N = 5000;
      const wins = new Map<string, number>();
      for (const v of activeVariants) wins.set(v.id, 0);
      if (activeVariants.length > 1) {
        for (let i = 0; i < N; i++) {
          let bestId = activeVariants[0].id;
          let bestVal = -1;
          for (const v of activeVariants) {
            const losses = Math.max(0, v.impressions - v.conversions);
            const s = sampleBeta(1 + v.conversions, 1 + losses);
            if (s > bestVal) { bestVal = s; bestId = v.id; }
          }
          wins.set(bestId, (wins.get(bestId) || 0) + 1);
        }
      } else if (activeVariants.length === 1) {
        wins.set(activeVariants[0].id, N);
      }

      const totalSlotImpressions = slotVariants.reduce((s, v) => s + v.impressions, 0);
      slotData[slot] = slotVariants
        .sort((a, b) => (b.impressions === 0 && a.impressions === 0 ? 0 : (b.conversions / Math.max(b.impressions, 1)) - (a.conversions / Math.max(a.impressions, 1))))
        .map((v) => {
          const cr = v.impressions > 0 ? v.conversions / v.impressions : 0;
          return {
            id: v.id,
            text: v.text,
            isActive: v.isActive,
            impressions: v.impressions,
            conversions: v.conversions,
            conversionRate: cr,
            deepConversions: deepStats?.get(v.id) || 0,
            trafficSharePct: v.isActive && totalSlotImpressions > 0 ? Math.round((v.impressions / totalSlotImpressions) * 100) : 0,
          };
        });
    }

    // Identify "winning combination" so far — the variant per slot with
    // the highest traffic share (most explored + best converting).
    const winning: Record<string, any> = {};
    for (const slot of slots) {
      const sorted = [...(slotData[slot] || [])].filter((v: any) => v.isActive).sort((a: any, b: any) => b.trafficSharePct - a.trafficSharePct);
      winning[slot] = sorted[0] || null;
    }

    out.push({
      slug: experiment.slug,
      name: experiment.name,
      isActive: experiment.isActive,
      slots: slotData,
      currentBest: winning,
    });
    } catch (e) {
      console.error(`[AB Tests] Error loading experiment ${expCfg.slug}:`, e);
    }
  }

  return NextResponse.json({ experiments: out });
}

/** Create a new variant for an experiment. */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { experimentSlug, slot, text } = body || {};
  if (!experimentSlug || !slot || (text === undefined || text === null)) return NextResponse.json({ error: "experimentSlug, slot y text requeridos" }, { status: 400 });
  if (!text && text !== "" && slot !== "subtitle") return NextResponse.json({ error: "text requerido para este slot" }, { status: 400 });
  if (!["title", "subtitle", "cta"].includes(slot)) return NextResponse.json({ error: "slot inválido" }, { status: 400 });

  const experiment = await prisma.abExperiment.findUnique({ where: { slug: experimentSlug } });
  if (!experiment) return NextResponse.json({ error: "Experimento no encontrado" }, { status: 404 });

  const variant = await prisma.abVariant.create({
    data: { experimentId: experiment.id, slot, text: String(text).trim() },
  });
  return NextResponse.json({ ok: true, variant });
}
