import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import StoreFront from "@/components/ecommerce/StoreFront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadEcommerceStorefront(slug);
  if (!data) return {};
  const { tenant } = data;
  return {
    title: `${tenant.name} · Pedir online`,
    description: `Haz tu pedido en ${tenant.name}. Rápido y fácil.`,
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

  return <StoreFront tenant={data.tenant} categories={data.categories} products={data.products} />;
}
