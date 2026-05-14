import { prisma } from "@/lib/prisma";

const EXPERIMENT_SLUG = "landing-hero";
const EXPERIMENT_NAME = "Landing Page Hero";

const VARIANTS: { slot: string; text: string }[] = [
  // title
  { slot: "title", text: "Tu carta puede vender mucho m\u00e1s" },
  { slot: "title", text: "\u00bfC\u00f3mo se ver\u00eda tu carta si vendiera sola?" },
  { slot: "title", text: "Tu carta no es el problema. C\u00f3mo la muestras, s\u00ed." },
  // subtitle
  { slot: "subtitle", text: "Transformamos tu carta actual en una que aumenta tus ventas" },
  { slot: "subtitle", text: "Descúbrelo gratis en segundos" },
  { slot: "subtitle", text: "Te mostramos gratis cómo se vería mejorada" },
  // cta
  { slot: "cta", text: "Sube tu carta \u00b7 60 segundos \u2192" },
  { slot: "cta", text: "Transforma tu carta \u2192" },
  { slot: "cta", text: "Ver c\u00f3mo queda \u2192" },
];

/**
 * Seeds the "landing-hero" A/B experiment if it doesn't already exist.
 * Call this at app startup or from a one-off script.
 */
export async function seedLandingExperiment() {
  const existing = await prisma.abExperiment.findUnique({
    where: { slug: EXPERIMENT_SLUG },
  });
  if (existing) return existing;

  const experiment = await prisma.abExperiment.create({
    data: {
      slug: EXPERIMENT_SLUG,
      name: EXPERIMENT_NAME,
      variants: {
        create: VARIANTS.map((v) => ({ slot: v.slot, text: v.text })),
      },
    },
    include: { variants: true },
  });

  return experiment;
}
