import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceTenant } from "@/lib/ecommerce/storefront-data";
import CheckoutForm from "@/components/ecommerce/CheckoutForm";
import GtmScript from "@/components/ecommerce/GtmScript";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await loadEcommerceTenant(slug);
  if (!tenant) return {};
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  return {
    title: `Finalizar pedido · ${tenant.name}`,
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
  };
}

export default async function EcommerceCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadEcommerceTenant(slug);
  if (!tenant) return notFound();
  const basePath = tenant.customDomain && slug === tenant.customDomain ? "" : `/ecommerce/${tenant.slug}`;
  return <><GtmScript id={tenant.gtmId} /><CheckoutForm tenant={tenant} basePath={basePath} /></>;
}
