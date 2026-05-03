import { prisma } from "@/lib/prisma";

export type Slot = "title" | "subtitle" | "cta";

export interface ExperimentVariant {
  id: string;
  slot: Slot;
  text: string;
  isActive: boolean;
  impressions: number;
  conversions: number;
}

/**
 * Loads the experiment with all its variants and computes per-variant
 * impressions and conversions from StatEvent.metadata. Used by both the
 * serving endpoint (Thompson Sampling) and the admin dashboard.
 *
 * Convention: the experiment slug is stored in metadata.abExperiment, and
 * each slot's chosen variant id is stored in metadata.titleId, .subtitleId,
 * .ctaId. Impressions come from the configured `impressionEventType` and
 * conversions from `conversionEventType`.
 */
export async function getExperimentVariantsWithStats(
  experimentSlug: string,
  impressionEventType: string,
  conversionEventType: string,
): Promise<{ experiment: { id: string; name: string; slug: string; isActive: boolean } | null; variants: ExperimentVariant[] }> {
  const experiment = await prisma.abExperiment.findUnique({
    where: { slug: experimentSlug },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  if (!experiment) return { experiment: null, variants: [] };

  // Pull all events tagged with this experiment. Volume is small (one row per
  // modal impression / save) so an in-memory aggregation is fine.
  const events = await prisma.statEvent.findMany({
    where: {
      eventType: { in: [impressionEventType, conversionEventType] as any },
      metadata: { path: ["abExperiment"], equals: experimentSlug },
    },
    select: { eventType: true, metadata: true },
  });

  const stats = new Map<string, { impressions: number; conversions: number }>();
  for (const e of events) {
    const m = e.metadata as any;
    if (!m) continue;
    for (const slot of ["title", "subtitle", "cta"] as const) {
      const id = m[`${slot}Id`];
      if (!id) continue;
      let bucket = stats.get(id);
      if (!bucket) {
        bucket = { impressions: 0, conversions: 0 };
        stats.set(id, bucket);
      }
      if (e.eventType === impressionEventType) bucket.impressions++;
      else if (e.eventType === conversionEventType) bucket.conversions++;
    }
  }

  const variants: ExperimentVariant[] = experiment.variants.map((v) => {
    const s = stats.get(v.id) || { impressions: 0, conversions: 0 };
    return {
      id: v.id,
      slot: v.slot as Slot,
      text: v.text,
      isActive: v.isActive,
      impressions: s.impressions,
      conversions: s.conversions,
    };
  });

  return {
    experiment: { id: experiment.id, name: experiment.name, slug: experiment.slug, isActive: experiment.isActive },
    variants,
  };
}
