import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEcommerceStorefrontBaseCached } from "@/lib/ecommerce/storefront-data";
import BranchDetail from "@/components/ecommerce/BranchDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEcommerceStorefrontBaseCached(slug);
  if (!data) return {};
  const { tenant } = data;
  const fullName = tenant.branchName ? `${tenant.name} ${tenant.branchName}` : tenant.name;
  const modalities: string[] = [];
  if (tenant.deliveryEnabled) modalities.push("delivery");
  if (tenant.pickupEnabled) modalities.push("retiro");
  if (tenant.showTableMenu) modalities.push("mesa");
  const modalityText = modalities.length ? ` ${modalities.join(", ")}.` : "";
  const title = `${fullName} · Dirección, horarios y cómo pedir`;
  const description = `${fullName}: dirección, horarios, carta y pedido online.${modalityText} ${tenant.address || ""}`.trim();
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  const productImages = data.products
    .map((p) => p.image_url)
    .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
    .slice(0, 4)
    .map((url) => ({ url, width: 1200, height: 630, alt: fullName }));
  const ogImages = [
    ...productImages,
    ...(tenant.logoUrl ? [{ url: tenant.logoUrl, width: 400, height: 400, alt: fullName }] : []),
  ];
  return {
    title,
    description,
    alternates: { canonical: `https://quierocomer.com/ecommerce/${tenant.slug}/local` },
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
    openGraph: { title: fullName, description, images: ogImages, type: "website" },
    twitter: { card: "summary_large_image", title: fullName, description, images: ogImages[0]?.url ? [ogImages[0].url] : [] },
  };
}

export default async function BranchLocalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getEcommerceStorefrontBaseCached(slug);
  if (!data) return notFound();
  const { tenant, categories, products } = data;

  // JSON-LD Restaurant
  const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const canonicalUrl = `${SITE}/ecommerce/${tenant.slug}`;
  const fullName = tenant.branchName ? `${tenant.name} ${tenant.branchName}` : tenant.name;
  const productPhotos = products.map(p => p.image_url).filter((u): u is string => !!u && /^https?:\/\//i.test(u));
  const imageArray = [...new Set([tenant.logoUrl, tenant.bannerUrl, ...productPhotos].filter((u): u is string => !!u && /^https?:\/\//i.test(u)))].slice(0, 15);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: fullName,
    url: canonicalUrl,
    ...(imageArray.length ? { image: imageArray } : {}),
    ...(tenant.address ? { address: { "@type": "PostalAddress", streetAddress: tenant.address, addressLocality: tenant.commune ?? undefined, addressCountry: "CL" } } : {}),
    ...(tenant.phone || tenant.whatsapp ? { telephone: tenant.phone || tenant.whatsapp } : {}),
    ...(tenant.primaryCategory ? { servesCuisine: tenant.primaryCategory } : {}),
    ...(tenant.metaDescription ? { description: tenant.metaDescription } : {}),
    potentialAction: [{ "@type": "OrderAction", target: canonicalUrl }],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BranchDetail tenant={tenant} categories={categories} products={products} />
    </>
  );
}
