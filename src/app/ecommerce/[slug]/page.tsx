import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import StoreFront from "@/components/ecommerce/StoreFront";
import ImpactStoreFront from "@/components/ecommerce/ImpactStoreFront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadEcommerceStorefront(slug);
  if (!data) return {};
  const { tenant } = data;
  return {
    title: `${tenant.name} · Pedir online`,
    description: `Haz tu pedido en ${tenant.name}. Rápido y fácil.`,
    ...(tenant.logoUrl ? { icons: { icon: tenant.logoUrl, shortcut: tenant.logoUrl, apple: tenant.logoUrl } } : {}),
    openGraph: {
      title: tenant.name,
      description: `Haz tu pedido en ${tenant.name}.`,
      images: tenant.logoUrl ? [{ url: tenant.logoUrl, width: 400, height: 400, alt: tenant.name }] : [],
      type: "website",
    },
  };
}

export default async function EcommerceStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadEcommerceStorefront(slug);
  if (!data) return notFound();

  // Si el request llegó por el dominio propio, el `slug` param es el host (= customDomain):
  // en ese caso las URLs internas son limpias (base ""); en el dominio principal usamos /ecommerce/<slug>.
  const basePath = data.tenant.customDomain && slug === data.tenant.customDomain ? "" : `/ecommerce/${data.tenant.slug}`;

  if (data.tenant.theme === "impact") {
    return <ImpactStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} />;
  }
  return <StoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} />;
}
