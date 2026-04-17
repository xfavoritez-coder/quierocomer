import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GarzonPanel from "./GarzonClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default async function GarzonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });

  if (!restaurant) return notFound();

  return (
    <>
      <link rel="manifest" href="/manifest-garzon.json" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <GarzonPanel restaurantId={restaurant.id} restaurantName={restaurant.name} />
    </>
  );
}
