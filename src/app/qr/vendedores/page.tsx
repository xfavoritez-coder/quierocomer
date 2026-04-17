import { prisma } from "@/lib/prisma";
import VendedoresPage from "@/components/qr/vendedores/VendedoresPage";

export const metadata = {
  title: "Vende Carta QR Viva — QuieroComer.cl",
  description: "Gana $25.000 por cada restaurante que cierras. Sin experiencia previa, sin límite de territorio.",
};

export default async function Page() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      bannerUrl: true,
      description: true,
      categories: { select: { name: true }, take: 3 },
    },
    orderBy: { createdAt: "asc" },
    take: 6,
  });

  return <VendedoresPage restaurants={restaurants} />;
}
