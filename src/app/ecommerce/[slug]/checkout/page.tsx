import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceTenant } from "@/lib/ecommerce/storefront-data";
import CheckoutForm from "@/components/ecommerce/CheckoutForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await loadEcommerceTenant(slug);
  if (!tenant) return {};
  return {
    title: `Finalizar pedido · ${tenant.name}`,
    ...(tenant.logoUrl ? { icons: { icon: tenant.logoUrl, shortcut: tenant.logoUrl, apple: tenant.logoUrl } } : {}),
  };
}

export default async function EcommerceCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadEcommerceTenant(slug);
  if (!tenant) return notFound();
  return <CheckoutForm tenant={tenant} />;
}
