import { Metadata } from "next";
import SubirCartaClient from "./SubirCartaClient";
import { getExperimentVariantsWithStats } from "@/lib/ab/getExperimentStats";
import { pickByThompsonSampling } from "@/lib/ab/sampling";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subir mi carta · QuieroComer",
  description: "Sube tu carta física, PDF o link QR y nuestra IA la transforma en una Carta Viva.",
};

const AB_DEFAULTS = {
  titleText: "Sube tu carta y mira cómo queda",
  ctaText: "Comenzar →",
};

export default async function SubirCartaPage() {
  const abData = await getExperimentVariantsWithStats(
    "subircarta-hero",
    "SUBIRCARTA_VIEWED",
    "SUBIRCARTA_CARTA_UPLOADED",
  ).catch(() => ({ experiment: null, variants: [] }));

  const ab: Record<string, any> = {};
  const activeVariants = abData.variants.filter(v => v.isActive);
  const stats = new Map(activeVariants.map(v => [v.id, { impressions: v.impressions, conversions: v.conversions }]));

  for (const slot of ["title", "cta"] as const) {
    const slotVariants = activeVariants.filter(v => v.slot === slot);
    if (slotVariants.length === 0 || !(abData as any).experiment?.isActive) {
      ab[`${slot}Id`] = null;
      ab[`${slot}Text`] = AB_DEFAULTS[`${slot}Text` as keyof typeof AB_DEFAULTS];
    } else {
      const picked = pickByThompsonSampling(
        slotVariants.map(v => ({ id: v.id, data: v })),
        stats,
      );
      ab[`${slot}Id`] = picked.data.id;
      ab[`${slot}Text`] = picked.data.text;
    }
  }

  return <SubirCartaClient serverAb={ab} />;
}
