import { prisma } from "@/lib/prisma";

const EXPERIMENT_SLUG = "landing-hero";
const EXPERIMENT_NAME = "Landing Page Hero";

/**
 * Idempotent seed — only adds variants that are explicitly listed here and
 * not yet in the DB. Does NOT touch existing variants.
 * Safe to call on every server startup.
 */
export async function seedLandingExperiment() {
  try {
    let experiment = await prisma.abExperiment.findUnique({
      where: { slug: EXPERIMENT_SLUG },
      include: { variants: { select: { id: true, slot: true, text: true, impressions: true } } },
    });

    if (!experiment) {
      // First-time create with just the baseline variants
      experiment = await prisma.abExperiment.create({
        data: {
          slug: EXPERIMENT_SLUG,
          name: EXPERIMENT_NAME,
          variants: {
            create: [
              { slot: "title", text: "Tu carta puede vender mucho más" },
              { slot: "title", text: "Convierte tu carta en tu mejor vendedor." },
            ],
          },
        },
        include: { variants: { select: { id: true, slot: true, text: true, impressions: true } } },
      });
      console.log(`[AB Seed] Created experiment "${EXPERIMENT_NAME}"`);
      return experiment;
    }

    // Only add the specific title variants we want
    const wantedTitles = [
      "Convierte tu carta en tu mejor vendedor.",
    ];

    const existingTexts = new Set(experiment.variants.map((v) => v.text));
    const toAdd = wantedTitles.filter((t) => !existingTexts.has(t));

    if (toAdd.length > 0) {
      await prisma.abVariant.createMany({
        data: toAdd.map((text) => ({ experimentId: experiment!.id, slot: "title", text })),
      });
      console.log(`[AB Seed] Added title variant(s): ${toAdd.map(t => `"${t}"`).join(", ")}`);
    }

    // Deactivate ALL cta variants — CTA "Subir mi carta →" is now fixed in code
    const activeCtas = experiment.variants.filter((v) => v.slot === "cta" && (v as any).isActive !== false);
    if (activeCtas.length > 0) {
      await prisma.abVariant.updateMany({
        where: { id: { in: activeCtas.map(v => v.id) } },
        data: { isActive: false },
      });
      console.log(`[AB Seed] Deactivated ${activeCtas.length} CTA variant(s) — CTA is now fixed`);
    }

    return experiment;
  } catch (e) {
    console.error("[AB Seed] Failed:", e);
  }
}
