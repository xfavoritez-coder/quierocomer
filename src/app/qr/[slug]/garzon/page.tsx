import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GarzonPanel from "@/app/qr/admin/garzon/[slug]/GarzonClient";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: restaurant ? `Garzón · ${restaurant.name}` : "Garzón",
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "mobile-web-app-capable": "yes",
    },
  };
}

export default async function GarzonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });

  if (!restaurant) return notFound();

  return (
    <>
      <link rel="manifest" href={`/api/manifest-garzon/${slug}`} />
      <link rel="apple-touch-icon" href="/icon-192.png" />
      <meta name="apple-mobile-web-app-title" content={`Garzón · ${restaurant.name}`} />
      <GarzonPanel restaurantId={restaurant.id} restaurantName={restaurant.name} />
    </>
  );
}
