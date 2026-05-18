import { NextRequest, NextResponse } from "next/server";
import { getExperimentVariantsWithStats } from "@/lib/ab/getExperimentStats";
import { pickByThompsonSampling } from "@/lib/ab/sampling";

export const dynamic = "force-dynamic";

const EXPERIMENT_SLUG = "landing-hero";

const DEFAULTS = {
  titleText: "Tu carta puede vender mucho m\u00e1s",
  subtitleText: "Transformamos tu carta actual en una herramienta que aumenta tus ventas y mejora la experiencia de tus clientes.",
  ctaText: "Sube tu carta \u00b7 60 segundos \u2192",
};

/**
 * Returns the variant text for each slot (title / subtitle / cta) chosen by
 * Thompson Sampling. Called by the landing page on mount.
 *
 * Supports ?v=a|b|c to force a specific variant letter (for preview).
 */
export async function GET(req: NextRequest) {
  const forced = req.nextUrl.searchParams.get("v")?.toLowerCase();

  const { experiment, variants } = await getExperimentVariantsWithStats(
    EXPERIMENT_SLUG,
    "LANDING_VIEWED",
    "LANDING_CTA_CLICK",
  );

  if (!experiment || !experiment.isActive) {
    return NextResponse.json({
      titleId: null, titleText: DEFAULTS.titleText,
      subtitleId: null, subtitleText: DEFAULTS.subtitleText,
      ctaId: null, ctaText: DEFAULTS.ctaText,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const activeVariants = variants.filter((v) => v.isActive);
  const stats = new Map<string, { impressions: number; conversions: number }>();
  for (const v of activeVariants) stats.set(v.id, { impressions: v.impressions, conversions: v.conversions });

  const result: Record<string, any> = {};

  for (const slot of ["title", "subtitle", "cta"] as const) {
    const slotVariants = activeVariants.filter((v) => v.slot === slot);
    if (slotVariants.length === 0) {
      result[`${slot}Id`] = null;
      result[`${slot}Text`] = DEFAULTS[`${slot}Text` as keyof typeof DEFAULTS];
      continue;
    }

    // If ?v=a|b|c, pick the variant by index (a=0, b=1, c=2)
    if (forced && ["a", "b", "c"].includes(forced)) {
      const idx = forced.charCodeAt(0) - "a".charCodeAt(0);
      const pick = slotVariants[Math.min(idx, slotVariants.length - 1)];
      result[`${slot}Id`] = pick.id;
      result[`${slot}Text`] = pick.text;
      continue;
    }

    const picked = pickByThompsonSampling(
      slotVariants.map((v) => ({ id: v.id, data: v })),
      stats,
    );
    result[`${slot}Id`] = picked.data.id;
    result[`${slot}Text`] = picked.data.text;
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
