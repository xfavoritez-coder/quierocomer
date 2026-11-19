import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceBrand, getEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import BrandStore from "@/components/ecommerce/BrandStore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data) return {};
  const faviconUrl = data.faviconUrl || data.logoUrl;
  const logoUrl = data.logoUrl || data.faviconUrl;
  return {
    title: `Locales · ${data.brandName}`,
    description: `Encuentra las sucursales de ${data.brandName}: dirección, horarios y área de reparto.`,
    ...(faviconUrl ? { icons: { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl } } : {}),
    openGraph: {
      title: `Locales · ${data.brandName}`,
      description: `Encuentra las sucursales de ${data.brandName}: dirección, horarios y área de reparto.`,
      images: logoUrl ? [{ url: logoUrl, width: 400, height: 400, alt: data.brandName }] : [],
      type: "website",
    },
  };
}

export default async function BrandLocalesPage({ params, searchParams }: { params: Promise<{ brand: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { brand } = await params;
  const sp = await searchParams;
  const themeOverride = typeof sp.theme === "string" ? sp.theme : undefined;
  const data = await loadEcommerceBrand(brand);
  const visible = data?.branches.filter((b) => !b.hidden) ?? [];
  if (!data || visible.length === 0) return notFound();
  const representative = await getEcommerceStorefront(visible[0].slug);
  if (!representative) return notFound();
  return <BrandStore brand={data} representative={representative} themeOverride={themeOverride} />;
}
