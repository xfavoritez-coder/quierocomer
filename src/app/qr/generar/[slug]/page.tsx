import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import QRPageClient from "./QRPageClient";

export default async function QRGeneratorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, logoUrl: true },
  });
  if (!restaurant) notFound();

  return <QRPageClient restaurant={restaurant} />;
}
