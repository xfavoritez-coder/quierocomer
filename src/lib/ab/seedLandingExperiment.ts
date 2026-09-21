import { prisma } from "@/lib/prisma";

const EXPERIMENT_SLUG = "landing-hero";
const EXPERIMENT_NAME = "Landing Page Hero";

const VARIANTS: { slot: string; text: string }[] = [
  // title
  { slot: "title", text: "Tu carta puede vender mucho más" },
  { slot: "title", text: "¿Cómo se vería tu carta si vendiera sola?" },
  { slot: "title", text: "Tu carta no es el problema. Cómo la muestras, sí." },
  { slot: "title", text: "Convierte tu carta en tu mejor vendedor." },
  // subtitle
  { slot: "subtitle", text: "Transformamos tu carta actual en una que aumenta tus ventas" },
  { slot: "subtitle", text: "Descúbrelo gratis en segundos" },
  { slot: "subtitle", text: "Te mostramos gratis cómo se vería mejorada" },
  // cta
  { slot: "cta", text: "Sube tu carta · 60 segundos →" },
  { slot: "cta", text: "Transforma tu carta →" },
  { slot: "cta", text: "Ver cómo queda →" },
];

/**
 * Idempotent seed — creates the experiment if it doesn't exist, and adds any
 * missing variants. Safe to call on every server startup.
 */
export async function seedLandingExperiment() {
  try {
    let experiment = await prisma.abExperiment.findUnique({
      where: { slug: EXPERIMENT_SLUG },
      include: { variants: { select: { slot: true, text: true } } },
    });

    if (!experiment) {
      experiment = await prisma.abExperiment.create({
        data: {
          slug: EXPERIMENT_SLUG,
          name: EXPERIMENT_NAME,
          variants: { create: VARIANTS.map((v) => ({ slot: v.slot, text: v.text })) },
        },
        include: { variants: { select: { slot: true, text: true } } },
      });
      console.log(`[AB Seed] Created experiment "${EXPERIMENT_NAME}" with ${VARIANTS.length} variants`);
      return experiment;
    }

    // Add any variants not yet in DB (match by slot+text)
    const existingKeys = new Set(experiment.variants.map((v) => `${v.slot}::${v.text}`));
    const missing = VARIANTS.filter((v) => !existingKeys.has(`${v.slot}::${v.text}`));

    if (missing.length > 0) {
      await prisma.abVariant.createMany({
        data: missing.map((v) => ({ experimentId: experiment!.id, slot: v.slot, text: v.text })),
      });
      console.log(`[AB Seed] Added ${missing.length} missing variant(s) to "${EXPERIMENT_NAME}": ${missing.map(v => `"${v.text}"`).join(", ")}`);
    }

    return experiment;
  } catch (e) {
    // Non-fatal — app works without the seed
    console.error("[AB Seed] Failed:", e);
  }
}
