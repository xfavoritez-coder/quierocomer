import { prisma } from "@/lib/prisma";
import LandingNew from "../(main)/LandingNew";

const FEATURED_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "el-menu-de-la-esquina"];
const FALLBACK_COLORS: Record<string, string> = {
  "hand-roll": "#dc2626",
  "horusvegan": "#1a5f3f",
  "juana-la-brava": "#7c2d12",
  "alleria-pizza": "#c0392b",
  "el-menu-de-la-esquina": "#2563eb",
};

export const dynamic = "force-dynamic";

const AB_WINNERS = {
  titleId: null,
  titleText: "Crea una carta QR inteligente que {vende más} por ti",
  subtitleId: null,
  subtitleText: "Aumenta tus ventas y mejora la experiencia de tus clientes.",
  ctaId: null,
  ctaText: "Crear carta gratis →",
};

export const metadata = {
  title: "Carta QR para restaurantes gratis | QuieroComer",
  description: "Crea tu carta QR digital gratis. Nuestra IA transforma tu carta física en una experiencia visual que recomienda platos, muestra fotos y vende más por ti.",
  openGraph: {
    title: "Carta QR para restaurantes gratis | QuieroComer",
    description: "Crea tu carta QR digital gratis. Nuestra IA transforma tu carta física en una experiencia visual que recomienda platos, muestra fotos y vende más por ti.",
    url: "https://quierocomer.com/landing",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
    images: [{ url: "https://quierocomer.com/og-landing.png", width: 1254, height: 1254, type: "image/png" }],
  },
  twitter: {
    card: "summary",
    title: "Carta QR para restaurantes gratis | QuieroComer",
    description: "Crea tu carta QR digital gratis. Nuestra IA transforma tu carta física en una experiencia visual que recomienda platos, muestra fotos y vende más por ti.",
    images: ["https://quierocomer.com/og-landing.png"],
  },
};

export default async function LandingPage() {
  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: FEATURED_SLUGS }, isActive: true },
    select: { name: true, slug: true, logoUrl: true },
  });

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
