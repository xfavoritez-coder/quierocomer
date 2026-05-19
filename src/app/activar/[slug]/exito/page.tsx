import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ExitoClient from "./ExitoClient";

export default async function ExitoPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { slug } = await params;
  const { plan } = await searchParams;

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug },
    select: { id: true, name: true, slug: true, logoUrl: true, plan: true, isDemo: true },
  });

  if (!restaurant) return notFound();

  return (
    <ExitoClient
      restaurant={{ name: restaurant.name, slug: restaurant.slug!, logoUrl: restaurant.logoUrl }}
      plan={(plan || restaurant.plan) as string}
      stillProcessing={restaurant.isDemo}
    />
  );
}
