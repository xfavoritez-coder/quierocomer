import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { randomBytes } from "crypto";
import QRPageClient from "./QRPageClient";

export default async function QRGeneratorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, logoUrl: true, qrToken: true },
  });
  if (!restaurant) notFound();

  // Backfill: locales creados antes de que existiera qrToken
  if (!restaurant.qrToken) {
    const token = randomBytes(8).toString("base64url");
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { qrToken: token },
    });
    restaurant = { ...restaurant, qrToken: token };
  }

  return <QRPageClient restaurant={restaurant} />;
}
