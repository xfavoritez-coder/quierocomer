import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LandingClient from "./LandingClient";

// TEMPORAL: redirect a /qr/ — quitar cuando se reactive el feed
const REDIRECT_TO_QR = true;

export const metadata: Metadata = {
  title: "QuieroComer.cl — Descubre qué pedir en restaurantes de Chile",
  description:
    "Encuentra los mejores platos de restaurantes en Chile. Fotos reales, precios actualizados, opciones veganas y vegetarianas. Descubre qué comer hoy.",
  keywords: [
    "restaurantes Chile",
    "qué comer",
    "carta digital",
    "menú online",
    "platos veganos",
    "platos vegetarianos",
    "delivery Chile",
    "food Chile",
  ],
  alternates: { canonical: "https://quierocomer.com" },
  openGraph: {
    title: "QuieroComer.cl — Descubre qué pedir en restaurantes de Chile",
    description:
      "Encuentra los mejores platos de restaurantes en Chile. Fotos reales, precios actualizados, opciones veganas y vegetarianas.",
    url: "https://quierocomer.com",
    siteName: "QuieroComer.cl",
    locale: "es_CL",
    type: "website",
    images: [{ url: "https://quierocomer.com/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuieroComer.cl — Descubre qué pedir en restaurantes de Chile",
    description:
      "Encuentra los mejores platos de restaurantes en Chile. Fotos reales, precios actualizados.",
  },
};

const FEATURED_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza"];
const FALLBACK_COLORS: Record<string, string> = {
  "hand-roll": "#dc2626",
  "horusvegan": "#1a5f3f",
  "juana-la-brava": "#7c2d12",
  "alleria-pizza": "#c0392b",
};

export default async function LandingPage() {
  if (REDIRECT_TO_QR) redirect("/qr/");

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

  return <LandingClient logos={logos} />;
}
