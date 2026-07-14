import { prisma } from "@/lib/prisma";
import LandingNew from "../(main)/LandingNew";

const FEATURED_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "el-menu-de-la-esquina", "guffsushi"];
const FALLBACK_COLORS: Record<string, string> = {
  "hand-roll": "#dc2626",
  "horusvegan": "#1a5f3f",
  "juana-la-brava": "#7c2d12",
  "alleria-pizza": "#c0392b",
  "el-menu-de-la-esquina": "#2563eb",
  "guffsushi": "#1a1a2e",
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "QuieroComer | La carta inteligente que vende más por ti",
  description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
  openGraph: {
    title: "QuieroComer | La carta inteligente que vende más por ti",
    description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
    url: "https://quierocomer.com/qr",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
    images: [{ url: "https://quierocomer.com/og-landing.png", width: 1254, height: 1254, type: "image/png" }],
  },
};

// A/B winners hardcoded — experiment concluded
const AB_WINNERS = {
  titleId: null,
  titleText: "Crea una carta QR inteligente que {vende más} por ti",
  subtitleId: null,
  subtitleText: "Aumenta tus ventas y mejora la experiencia de tus clientes.",
  ctaId: null,
  ctaText: "Crear carta gratis",
};

export default async function QRLandingPage() {
  const restaurants = await Promise.race([
    prisma.restaurant.findMany({
      where: { slug: { in: FEATURED_SLUGS }, isActive: true },
      select: { name: true, slug: true, logoUrl: true },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db timeout")), 8000)),
  ]).catch(() => [] as { name: string; slug: string; logoUrl: string | null }[]);

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

  return <LandingNew logos={logos} serverAb={AB_WINNERS} />;
}
