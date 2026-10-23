import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import FilaForm from "./FilaForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { name: true } });
  return { title: r ? `Fila · ${r.name}` : "Fila virtual" };
}

export default async function FilaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true, logoUrl: true, cartaAccentColor: true, queueEnabled: true },
  });
  if (!r) return notFound();

  return (
    <FilaForm
      slug={slug}
      name={r.name}
      logoUrl={r.logoUrl}
      accent={r.cartaAccentColor || "#e63946"}
      enabled={r.queueEnabled}
    />
  );
}
