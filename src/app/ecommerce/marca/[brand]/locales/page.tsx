import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceBrand, getEcommerceStorefront, getEcommerceStorefrontBaseCached } from "@/lib/ecommerce/storefront-data";
import BrandStore from "@/components/ecommerce/BrandStore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const data = await loadEcommerceBrand(brand);
  if (!data) return {};
  const faviconUrl = data.faviconUrl || data.logoUrl;
  const logoUrl = data.logoUrl || data.faviconUrl;
  const title = `Locales · ${data.brandName}`;
  const description = `Encuentra las sucursales de ${data.brandName}: dirección, horarios y área de reparto.`;
  // Cargar productos del representante para og:image
  const visible = data.branches.filter((b) => !b.hidden);
  const repData = visible[0] ? await getEcommerceStorefrontBaseCached(visible[0].slug) : null;
  const productImages = (repData?.products ?? [])
    .map((p) => p.image_url)
    .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
    .slice(0, 6)
    .map((url) => ({ url, width: 1200, height: 630, alt: data.brandName }));
  const ogImages: { url: string; width?: number; height?: number; alt?: string }[] = [
    ...productImages,
    ...(logoUrl ? [{ url: logoUrl, width: 400, height: 400, alt: data.brandName }] : []),
  ];
  return {
    title,
    description,
    ...(faviconUrl ? { icons: { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl } } : {}),
    openGraph: { title, description, images: ogImages, type: "website" },
    twitter: { card: "summary_large_image", title, description, images: ogImages[0]?.url ? [ogImages[0].url] : [] },
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

  // JSON-LD: cada sucursal como Restaurant para SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: data.brandName,
    ...(data.logoUrl ? { logo: data.logoUrl } : {}),
    department: visible.map(b => ({
      "@type": "Restaurant",
      name: `${b.name}${b.branchName ? ` ${b.branchName}` : ''}`,
      ...(b.address ? { address: { "@type": "PostalAddress", streetAddress: b.address, addressCountry: "CL" } } : {}),
      ...(b.phone ? { telephone: b.phone } : {}),
      ...(b.lat && b.lng ? { geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } } : {}),
      url: `https://quierocomer.com/ecommerce/${b.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BrandStore brand={data} representative={representative} themeOverride={themeOverride} />
    </>
  );
}
