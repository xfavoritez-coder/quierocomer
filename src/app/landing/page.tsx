import { prisma } from "@/lib/prisma";
import LandingNew from "../(main)/LandingNew";

const FEATURED_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "nascosto-pizzeria"];
const FALLBACK_COLORS: Record<string, string> = {
  "hand-roll": "#dc2626",
  "horusvegan": "#1a5f3f",
  "juana-la-brava": "#7c2d12",
  "alleria-pizza": "#c0392b",
  "nascosto-pizzeria": "#e85530",
};

export const metadata = {
  title: "QuieroComer | La carta inteligente que vende más por ti",
  description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
  openGraph: {
    title: "QuieroComer | La carta inteligente que vende más por ti",
    description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
    url: "https://quierocomer.cl/landing",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
    images: [{ url: "https://quierocomer.cl/og.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuieroComer | La carta inteligente que vende más por ti",
    description: "Transforma tu carta en una experiencia visual que recomienda platos, muestra fotos, sugiere extras y ayuda al cliente a decidir mejor.",
    images: ["https://quierocomer.cl/og.png"],
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

  return <LandingNew logos={logos} />;
}
