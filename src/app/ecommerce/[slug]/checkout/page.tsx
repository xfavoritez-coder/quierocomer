import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceTenant, loadEcommerceBrandByDomain } from "@/lib/ecommerce/storefront-data";
import CheckoutForm from "@/components/ecommerce/CheckoutForm";
import GtmScript from "@/components/ecommerce/GtmScript";
import MetaPixelScript from "@/components/ecommerce/MetaPixelScript";

export const dynamic = "force-dynamic";

// viewport-fit=cover para que env(safe-area-inset-*) funcione dentro de la app
// nativa (WebView) — header y botones respetan el notch/home-indicator.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

async function resolveTenant(slug: string) {
  let tenant = await loadEcommerceTenant(slug);
  if (!tenant && slug.includes(".")) {
    const brand = await loadEcommerceBrandByDomain(slug);
    if (brand?.branches.length) tenant = await loadEcommerceTenant(brand.branches[0].slug);
  }
  return tenant;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return {};
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  return {
    title: `Finalizar pedido · ${tenant.name}`,
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
  };
}

export default async function EcommerceCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return notFound();
  const basePath = slug.includes(".") ? "" : (tenant.customDomain && slug === tenant.customDomain ? "" : `/ecommerce/${tenant.slug}`);
  return <><GtmScript id={tenant.gtmId} /><MetaPixelScript id={tenant.metaPixelId} /><CheckoutForm tenant={tenant} basePath={basePath} /></>;
}
