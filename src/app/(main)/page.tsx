import { prisma } from "@/lib/prisma";
import LandingClient from "./LandingClient";

const FEATURED_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "vegan-mobile"];
const FALLBACK_COLORS: Record<string, string> = {
  "hand-roll": "#dc2626",
  "horusvegan": "#1a5f3f",
  "juana-la-brava": "#7c2d12",
  "vegan-mobile": "#16a34a",
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

  return <LandingClient logos={logos} />;
}
