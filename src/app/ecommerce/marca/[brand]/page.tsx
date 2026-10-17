import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceBrand } from "@/lib/ecommerce/storefront-data";
import BrandChooser from "./BrandChooser";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data) return {};
  return {
    title: `${data.brandName} · Pedir online`,
    description: `Elige tu sucursal de ${data.brandName} y haz tu pedido.`,
    ...(data.logoUrl ? { icons: { icon: data.logoUrl } } : {}),
  };
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data || data.branches.length === 0) return notFound();
  return <BrandChooser brand={data} />;
}
