import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import CartelCliente from "./CartelCliente";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { name: true } });
  return { title: r ? `Cartel fila · ${r.name}` : "Cartel fila virtual" };
}

export default async function CartelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true, logoUrl: true, cartaAccentColor: true },
  });
  if (!r) return notFound();

  const url = `https://quierocomer.com/fila/${slug}`;
  return <CartelCliente name={r.name} logoUrl={r.logoUrl} accent={r.cartaAccentColor || "#e63946"} url={url} />;
}
