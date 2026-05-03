import { NextResponse } from "next/server";
import { getExperimentVariantsWithStats } from "@/lib/ab/getExperimentStats";
import { pickByThompsonSampling } from "@/lib/ab/sampling";

export const dynamic = "force-dynamic";

const EXPERIMENT_SLUG = "birthday-modal";

/**
 * Returns the variant text for each slot (title / subtitle / cta) chosen by
 * Thompson Sampling. Called by the carta on the customer's first time the
 * modal is about to render. The response includes the variant ids so the
 * tracking events can attribute the impression / conversion back to them.
 *
 * No auth — public endpoint. The carta itself is public.
 */
export async function GET() {
  const { experiment, variants } = await getExperimentVariantsWithStats(
    EXPERIMENT_SLUG,
    "BIRTHDAY_MODAL_AUTO_SHOWN",
    "BIRTHDAY_SAVED",
  );

  if (!experiment || !experiment.isActive) {
    // Fallback: if the experiment is missing or paused, return null so the
    // client can use its hardcoded defaults.
    return NextResponse.json({ experimentSlug: EXPERIMENT_SLUG, hasVariants: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const activeVariants = variants.filter((v) => v.isActive);
  const stats = new Map<string, { impressions: number; conversions: number }>();
  for (const v of activeVariants) stats.set(v.id, { impressions: v.impressions, conversions: v.conversions });

  const result: Record<string, any> = { experimentSlug: EXPERIMENT_SLUG, hasVariants: true };
  for (const slot of ["title", "subtitle", "cta"] as const) {
    const slotVariants = activeVariants.filter((v) => v.slot === slot);
    if (slotVariants.length === 0) continue;
    const picked = pickByThompsonSampling(
      slotVariants.map((v) => ({ id: v.id, data: v })),
      stats,
    );
    result[`${slot}Id`] = picked.data.id;
    result[`${slot}Text`] = picked.data.text;
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
