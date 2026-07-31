import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ResenaClient from "./ResenaClient";
import PageHitTracker from "@/components/PageHitTracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { name: true, logoUrl: true } });
  if (!r) return {};
  return {
    title: `Deja tu opinión · ${r.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function ResenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, reviewMode: true, reviewReward: true },
  });

  if (!restaurant || restaurant.reviewMode !== "private") return notFound();

  return (
    <>
      <PageHitTracker restaurantId={restaurant.id} page="resena" />
      <ResenaClient restaurant={{ ...restaurant, slug }} />
    </>
  );
}
