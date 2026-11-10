import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceBrand, getEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import BrandStore from "@/components/ecommerce/BrandStore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data) return {};
  const iconUrl = data.faviconUrl || data.logoUrl;
  const title = data.pageTitle || `${data.brandName} · Pedir online`;
  const description = data.metaDescription || `Haz tu pedido en ${data.brandName}: elige delivery o retiro y te asignamos la sucursal.`;
  return {
    title,
    description,
    alternates: { canonical: `https://quierocomer.com/ecommerce/marca/${brand}` },
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
    openGraph: {
      title: data.pageTitle || data.brandName,
      description,
      images: iconUrl ? [{ url: iconUrl, width: 400, height: 400, alt: data.brandName }] : [],
      type: "website",
    },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data || data.branches.length === 0) return notFound();
  // Menú compartido: se muestra directo el catálogo de una sucursal "representante"
  // (los menús son iguales entre sucursales de la marca). La sucursal real se elige
  // recién al agregar algo al carrito (ver BrandStore).
  const representative = await getEcommerceStorefront(data.branches[0].slug);
  if (!representative) return notFound();
  return <BrandStore brand={data} representative={representative} />;
}
