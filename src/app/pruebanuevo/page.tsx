import { prisma } from "@/lib/prisma";
import TestPage from "./TestPage";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Prueba taxonomía — Interno",
};

export default async function PruebanuevoPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; r?: string }>;
}) {
  const { slug: slugParam } = await searchParams;

  let slug = slugParam;

  if (!slug) {
    const candidates = await prisma.$queryRaw<{ slug: string }[]>`
      SELECT r.slug
      FROM "Restaurant" r
      WHERE r."isActive" = true AND r."isDemo" = false AND r."isShowcase" = false
      AND (
        SELECT COUNT(*) FROM "Dish" d
        WHERE d."restaurantId" = r.id
          AND d."isActive" = true
          AND d."deletedAt" IS NULL
          AND array_length(d.photos, 1) > 0
      ) >= 5
      ORDER BY RANDOM()
      LIMIT 1
    `;
    slug = candidates[0]?.slug;
  }

  if (!slug) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#666" }}>No se encontraron restaurantes con suficientes platos.</p>
      </div>
    );
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      dishes: {
        where: { isActive: true, deletedAt: null },
        include: { category: true },
        orderBy: [{ isHero: "desc" }, { position: "asc" }],
        take: 40,
      },
    },
  });

  if (!restaurant) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#666" }}>Restaurante &quot;{slug}&quot; no encontrado.</p>
      </div>
    );
  }

  return <TestPage restaurant={restaurant} />;
}
