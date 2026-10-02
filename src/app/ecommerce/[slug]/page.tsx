import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import StoreFront from "@/components/ecommerce/StoreFront";
import ImpactStoreFront from "@/components/ecommerce/ImpactStoreFront";
import GtmScript from "@/components/ecommerce/GtmScript";
import StorePwa from "@/components/ecommerce/StorePwa";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadEcommerceStorefront(slug);
  if (!data) return {};
  const { tenant } = data;
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  // PWA: manifest por local. base "" en dominio propio, "/ecommerce/<slug>" en el principal.
  const base = tenant.customDomain && slug === tenant.customDomain ? "" : `/ecommerce/${tenant.slug}`;
  const manifestUrl = `/api/ecommerce/manifest/${tenant.slug}?base=${encodeURIComponent(base)}`;
  return {
    title: `${tenant.name} · Pedir online`,
    description: `Haz tu pedido en ${tenant.name}. Rápido y fácil.`,
    manifest: manifestUrl,
    appleWebApp: { capable: true, title: tenant.name, statusBarStyle: "default" },
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
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

  const gtm = <GtmScript id={data.tenant.gtmId} />;
  // PWA instalable solo en dominio propio (scope "/"); en el dominio principal la tienda sigue como web.
  const pwa = <StorePwa enabled={basePath === ""} />;
  if (data.tenant.theme === "impact") {
    return <>{gtm}{pwa}<ImpactStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} /></>;
  }
  return <>{gtm}{pwa}<StoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} /></>;
}
