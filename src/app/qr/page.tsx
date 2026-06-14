import { prisma } from "@/lib/prisma";
import LandingNew from "../(main)/LandingNew";
import { getExperimentVariantsWithStats } from "@/lib/ab/getExperimentStats";
import { pickByThompsonSampling } from "@/lib/ab/sampling";

const FEATURED_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "el-menu-de-la-esquina", "krua-thai"];
const FALLBACK_COLORS: Record<string, string> = {
  "hand-roll": "#dc2626",
  "horusvegan": "#1a5f3f",
  "juana-la-brava": "#7c2d12",
  "alleria-pizza": "#c0392b",
  "el-menu-de-la-esquina": "#2563eb",
  "krua-thai": "#e65100",
};

export const metadata = {
  title: "QuieroComer | La carta inteligente que vende más por ti",
  description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
  openGraph: {
    title: "QuieroComer | La carta inteligente que vende más por ti",
    description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
    url: "https://quierocomer.cl/qr",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
    images: [{ url: "https://quierocomer.cl/og-landing.png", width: 1254, height: 1254, type: "image/png" }],
  },
};

const AB_DEFAULTS = {
  titleText: "Tu carta puede vender más",
  subtitleText: "Transforma tu carta actual en una herramienta que aumenta tus ventas y mejora la experiencia de tus clientes.",
  ctaText: "Sube tu carta · 60 segundos →",
};

export default async function QRLandingPage() {
  const [restaurants, abData] = await Promise.all([
    prisma.restaurant.findMany({
      where: { slug: { in: FEATURED_SLUGS }, isActive: true },
      select: { name: true, slug: true, logoUrl: true },
    }),
    getExperimentVariantsWithStats("landing-hero", "LANDING_VIEWED", "LANDING_CTA_CLICK").catch(() => ({ experiment: null, variants: [] })),
  ]);

  const logos = FEATURED_SLUGS.map((slug) => {
    const r = restaurants.find((x) => x.slug === slug);
    return {
      slug,
      name: r?.name || slug,
      logoUrl: r?.logoUrl || null,
      color: FALLBACK_COLORS[slug] || "#666",
      initials: (r?.name || slug).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
    };
  });

  const ab: Record<string, any> = {};
  const activeVariants = abData.variants.filter(v => v.isActive);
  const stats = new Map(activeVariants.map(v => [v.id, { impressions: v.impressions, conversions: v.conversions }]));

  for (const slot of ["title", "subtitle", "cta"] as const) {
    const slotVariants = activeVariants.filter(v => v.slot === slot);
    if (slotVariants.length === 0 || !abData.experiment?.isActive) {
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

  return <LandingNew logos={logos} serverAb={ab} />;
}
