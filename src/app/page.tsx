import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { getExperimentVariantsWithStats } from "@/lib/ab/getExperimentStats";
import { pickByThompsonSampling } from "@/lib/ab/sampling";

export const metadata: Metadata = {
  title: "QuieroComer — Carta digital QR y fidelización para restaurantes",
  description:
    "Crea tu carta digital con fotos, programa de sellos y pedidos online. Sin app, sin contratos. Úsalo desde el primer día. Prueba gratis 7 días.",
  keywords: [
    "carta digital restaurante",
    "carta QR restaurante Chile",
    "menú digital con fotos",
    "programa fidelización restaurante",
    "pedidos online restaurante",
    "software restaurante Chile",
    "QuieroComer",
  ],
  openGraph: {
    title: "QuieroComer — Carta digital QR y fidelización para restaurantes",
    description:
      "Carta digital con fotos, programa de sellos y pedidos online para tu restaurante. Sin app, sin contratos. Prueba gratis 7 días.",
    url: "https://quierocomer.com",
    siteName: "QuieroComer",
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuieroComer — Carta digital QR y fidelización para restaurantes",
    description:
      "Carta digital con fotos, programa de sellos y pedidos online. Sin app, sin contratos.",
  },
  alternates: {
    canonical: "https://quierocomer.com",
  },
};

const DEFAULT_TITLE = "Tu restaurante puede vender más.";

async function getHeroVariant(): Promise<{ titleText: string; titleId: string | null }> {
  try {
    const { experiment, variants } = await getExperimentVariantsWithStats(
      "landing-hero",
      "LANDING_VIEWED",
      "LANDING_CTA_CLICK",
    );
    if (!experiment?.isActive) return { titleText: DEFAULT_TITLE, titleId: null };

    const titleVariants = variants.filter((v) => v.isActive && v.slot === "title");
    if (titleVariants.length === 0) return { titleText: DEFAULT_TITLE, titleId: null };

    const stats = new Map(
      titleVariants.map((v) => [v.id, { impressions: v.impressions, conversions: v.conversions }]),
    );
    const picked = pickByThompsonSampling(
      titleVariants.map((v) => ({ id: v.id, data: v })),
      stats,
    );
    return { titleText: picked.data.text, titleId: picked.data.id };
  } catch {
    return { titleText: DEFAULT_TITLE, titleId: null };
  }
}

export default async function HomePage() {
  const { titleText, titleId } = await getHeroVariant();
  return <LandingPage initialTitleText={titleText} initialTitleId={titleId} />;
}
