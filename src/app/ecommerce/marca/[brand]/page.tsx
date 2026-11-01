import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceBrand, loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import BrandStore from "@/components/ecommerce/BrandStore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data) return {};
  return {
    title: `${data.brandName} · Pedir online`,
    description: `Haz tu pedido en ${data.brandName}: elige delivery o retiro y te asignamos la sucursal.`,
    ...(data.logoUrl ? { icons: { icon: data.logoUrl } } : {}),
  };
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data || data.branches.length === 0) return notFound();
  // Menú compartido: se muestra directo el catálogo de una sucursal "representante"
  // (los menús son iguales entre sucursales de la marca). La sucursal real se elige
  // recién al agregar algo al carrito (ver BrandStore).
  const representative = await loadEcommerceStorefront(data.branches[0].slug);
  if (!representative) return notFound();
  return <BrandStore brand={data} representative={representative} />;
}
