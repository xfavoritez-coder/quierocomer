import { NextRequest, NextResponse } from "next/server";
import { getExperimentVariantsWithStats, ExperimentVariant } from "@/lib/ab/getExperimentStats";
import { pickByThompsonSampling } from "@/lib/ab/sampling";

export const dynamic = "force-dynamic";

const EXPERIMENT_SLUG = "subircarta-hero";

const DEFAULTS = {
  titleText: "Sube tu carta y mira cómo queda",
  subtitleText: "Solo necesitas un link o una foto. En 60 segundos transformamos tu carta.",
  ctaText: "Comenzar →",
};

// Cache stats for 60s to avoid querying StatEvent on every page load
let cachedData: { experiment: any; variants: ExperimentVariant[] } | null = null;
let cachedAt = 0;
const CACHE_TTL = 60_000;

async function getCachedExperiment() {
  if (cachedData && Date.now() - cachedAt < CACHE_TTL) return cachedData;
  cachedData = await getExperimentVariantsWithStats(
    EXPERIMENT_SLUG,
    "SUBIRCARTA_VIEWED",
    "SUBIRCARTA_CARTA_UPLOADED",
  );
  cachedAt = Date.now();
  return cachedData;
}

export async function GET(req: NextRequest) {
  const { experiment, variants } = await getCachedExperiment();

  if (!experiment || !experiment.isActive) {
    return NextResponse.json({
      titleId: null, titleText: DEFAULTS.titleText,
      subtitleId: null, subtitleText: DEFAULTS.subtitleText,
      ctaId: null, ctaText: DEFAULTS.ctaText,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const activeVariants = variants.filter(v => v.isActive);
  const stats = new Map(activeVariants.map(v => [v.id, { impressions: v.impressions, conversions: v.conversions }]));

  const result: Record<string, any> = {};
  for (const slot of ["title", "subtitle", "cta"] as const) {
    const slotVariants = activeVariants.filter(v => v.slot === slot);
    if (slotVariants.length === 0) {
      result[`${slot}Id`] = null;
      result[`${slot}Text`] = DEFAULTS[`${slot}Text` as keyof typeof DEFAULTS];
      continue;
    }
    const picked = pickByThompsonSampling(
      slotVariants.map(v => ({ id: v.id, data: v })),
      stats,
    );
    result[`${slot}Id`] = picked.data.id;
    result[`${slot}Text`] = picked.data.text;
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
