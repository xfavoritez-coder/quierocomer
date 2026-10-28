import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import StoreFront from "@/components/ecommerce/StoreFront";
import ImpactStoreFront from "@/components/ecommerce/ImpactStoreFront";
import GtmScript from "@/components/ecommerce/GtmScript";
import StorePwa from "@/components/ecommerce/StorePwa";
import AppFlagSync from "@/components/ecommerce/AppFlagSync";
import StoreJsonLd from "@/components/ecommerce/StoreJsonLd";
import PageHitTracker from "@/components/PageHitTracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadEcommerceStorefront(slug);
  if (!data) return {};
  const { tenant } = data;
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  // Fotos de productos para el preview al compartir (OpenGraph): varias, no solo el logo.
  const ogImages = [
    ...data.products
      .map((p) => p.image_url)
      .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
      .slice(0, 4)
      .map((url) => ({ url })),
    ...(tenant.logoUrl ? [{ url: tenant.logoUrl, width: 400, height: 400, alt: tenant.name }] : []),
  ];
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
      images: ogImages,
      type: "website",
    },
  };
}

export default async function EcommerceStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // ¿La request viene desde la app nativa? La cookie qc_app la setea <AppFlagSync/>
  // cuando detecta la WebView de Capacitor. Solo entonces se cargan los platos appOnly.
  const fromApp = (await cookies()).get("qc_app")?.value === "1";
  const data = await loadEcommerceStorefront(slug, { fromApp });
  if (!data) return notFound();

  // Si el request llegó por el dominio propio, el `slug` param es el host (= customDomain):
  // en ese caso las URLs internas son limpias (base ""); en el dominio principal usamos /ecommerce/<slug>.
  const basePath = data.tenant.customDomain && slug === data.tenant.customDomain ? "" : `/ecommerce/${data.tenant.slug}`;

  const gtm = <GtmScript id={data.tenant.gtmId} />;
  // PWA instalable solo en dominio propio (scope "/"); en el dominio principal la tienda sigue como web.
  const pwa = <StorePwa enabled={basePath === ""} />;
  const hit = <PageHitTracker restaurantId={data.tenant.id} page="ecommerce" />;
  // Sincroniza la cookie qc_app: si corre dentro de la app, la activa (y refresca
  // una vez) para que aparezcan los platos exclusivos; si no, no hace nada.
  const appSync = <AppFlagSync active={fromApp} />;
  // Datos estructurados para que Google muestre las fotos de los productos.
  const jsonLd = <StoreJsonLd tenant={data.tenant} categories={data.categories} products={data.products} />;
  if (data.tenant.theme === "impact") {
    return <>{gtm}{pwa}{hit}{appSync}{jsonLd}<ImpactStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} /></>;
  }
  return <>{gtm}{pwa}{hit}{appSync}{jsonLd}<StoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} /></>;
}
