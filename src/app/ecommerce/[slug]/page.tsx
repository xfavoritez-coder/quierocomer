import { notFound } from "next/navigation";
import { requestIsFromApp } from "@/lib/ecommerce/appRequest";
import type { Metadata } from "next";
import { getEcommerceStorefront, getEcommerceStorefrontBaseCached, loadEcommerceBrandByDomain, loadEcommerceBrand, loadBrandSlugForSlug } from "@/lib/ecommerce/storefront-data";
import type { BrandBranch } from "@/lib/ecommerce/storefront-data";
import StoreFront from "@/components/ecommerce/StoreFront";
import BrandStore from "@/components/ecommerce/BrandStore";
import ImpactStoreFront from "@/components/ecommerce/ImpactStoreFront";
import ModernStoreFront from "@/components/ecommerce/ModernStoreFront";
import GtmScript from "@/components/ecommerce/GtmScript";
import MetaPixelScript from "@/components/ecommerce/MetaPixelScript";
import StorePwa from "@/components/ecommerce/StorePwa";
import AppFlagSync from "@/components/ecommerce/AppFlagSync";
import AppPushRegister from "@/components/ecommerce/AppPushRegister";
import AppPushOptIn from "@/components/ecommerce/AppPushOptIn";
import StoreJsonLd from "@/components/ecommerce/StoreJsonLd";
import PageHitTracker from "@/components/PageHitTracker";

export const dynamic = "force-dynamic";

// viewport-fit=cover habilita env(safe-area-inset-*) dentro de la app nativa
// (Capacitor WebView iOS/Android) para que el contenido no quede bajo el notch/
// status bar. En web sin safe-area no tiene efecto visible.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // Dominio de marca (ej. kojo.cl): metadata de la marca con fotos de productos.
  if (slug.includes(".")) {
    const brand = await loadEcommerceBrandByDomain(slug);
    if (brand) {
      const brandFavicon = brand.faviconUrl || brand.logoUrl;
      const brandLogo = brand.logoUrl || brand.faviconUrl;
      const brandTitle = brand.pageTitle || `${brand.brandName} · Pedir online`;
      const brandDesc = brand.metaDescription || `Haz tu pedido en ${brand.brandName}: elige delivery o retiro y te asignamos la sucursal.`;
      // Cargar productos del representante para og:image (Google Search preview)
      const visible = brand.branches.filter((b) => !b.hidden);
      const repData = visible[0] ? await getEcommerceStorefrontBaseCached(visible[0].slug) : null;
      const brandProductImages = (repData?.products ?? [])
        .map((p) => p.image_url)
        .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
        .slice(0, 6)
        .map((url) => ({ url, width: 1200, height: 630, alt: brand.brandName }));
      const ogImages: { url: string; width?: number; height?: number; alt?: string }[] = [
        ...brandProductImages,
        ...(brandLogo ? [{ url: brandLogo, width: 400, height: 400, alt: brand.brandName }] : []),
      ];
      return {
        title: brandTitle,
        description: brandDesc,
        ...(brandFavicon ? { icons: { icon: brandFavicon, shortcut: brandFavicon, apple: brandFavicon } } : {}),
        openGraph: { title: brand.pageTitle || brand.brandName, description: brandDesc, images: ogImages, type: "website" },
        twitter: { card: "summary_large_image", title: brand.pageTitle || brand.brandName, description: brandDesc, images: ogImages[0]?.url ? [ogImages[0].url] : [] },
      };
    }
  }
  // Metadata: basta el catálogo cacheado (no necesita la capa en vivo).
  const data = await getEcommerceStorefrontBaseCached(slug);
  if (!data) return {};
  const { tenant } = data;
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  // Fotos de productos primero (Google toma la 1ra para preview en resultados de búsqueda),
  // luego logo al final (WhatsApp fallback).
  const productImages = data.products
    .map((p) => p.image_url)
    .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
    .slice(0, 6)
    .map((url) => ({ url, width: 1200, height: 630, alt: tenant.name }));
  const ogImages: { url: string; width?: number; height?: number; alt?: string }[] = [
    ...productImages,
    ...(tenant.logoUrl ? [{ url: tenant.logoUrl, width: 400, height: 400, alt: tenant.name }] : []),
  ];
  // PWA: manifest por local. base "" en dominio propio, "/ecommerce/<slug>" en el principal.
  const base = tenant.customDomain && slug === tenant.customDomain ? "" : `/ecommerce/${tenant.slug}`;
  const manifestUrl = `/api/ecommerce/manifest/${tenant.slug}?base=${encodeURIComponent(base)}`;
  const title = tenant.pageTitle || `${tenant.name} · Pedir online`;
  const description = tenant.metaDescription || `Haz tu pedido en ${tenant.name}. Rápido y fácil.`;
  return {
    title,
    description,
    alternates: { canonical: tenant.customDomain ? `https://${tenant.customDomain}` : `https://quierocomer.com/tienda/${tenant.slug}` },
    manifest: manifestUrl,
    appleWebApp: { capable: true, title: tenant.name, statusBarStyle: "default" },
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
    openGraph: {
      title: tenant.pageTitle || tenant.name,
      description: tenant.metaDescription || `Haz tu pedido en ${tenant.name}.`,
      images: ogImages,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tenant.pageTitle || tenant.name,
      description,
      images: ogImages[0]?.url ? [ogImages[0].url] : [],
    },
  };
}

export default async function EcommerceStorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const themeOverride = typeof sp.theme === "string" ? sp.theme : null;
  // ¿La request viene desde la app nativa? Por User-Agent (token de la app, ya en
  // el PRIMER render) o por la cookie qc_app (fallback). Solo entonces se cargan los
  // platos appOnly. Ver src/lib/ecommerce/appRequest.ts.
  const fromApp = await requestIsFromApp();

  // ── Dominio de MARCA (ej. kojo.cl) ──────────────────────────────────────────
  // Si la request llega por el dominio propio de una marca, servimos la página de
  // marca (menú compartido; el cliente elige sucursal al agregar al carrito), igual
  // que /ecommerce/marca/<brandSlug>, pero en el dominio propio.
  if (slug.includes(".")) {
    const brand = await loadEcommerceBrandByDomain(slug);
    if (brand && brand.branches.length > 0) {
      const representative = await getEcommerceStorefront(brand.branches[0].slug, { fromApp });
      if (representative) {
        return (
          <>
            <GtmScript id={brand.gtmId ?? representative.tenant.gtmId} />
            <MetaPixelScript id={brand.metaPixelId ?? representative.tenant.metaPixelId} />
            <PageHitTracker restaurantId={representative.tenant.id} page="ecommerce" />
            <StoreJsonLd tenant={representative.tenant} categories={representative.categories} products={representative.products} />
            <BrandStore brand={brand} representative={representative} basePath="" />
          </>
        );
      }
    }
  }

  // Catálogo cacheado + disponibilidad/horario en vivo mezclados.
  const data = await getEcommerceStorefront(slug, { fromApp });
  if (!data) return notFound();

  // Si el request llegó por el dominio propio, el `slug` param es el host (= customDomain):
  // en ese caso las URLs internas son limpias (base ""); en el dominio principal usamos /ecommerce/<slug>.
  const basePath = data.tenant.customDomain && slug === data.tenant.customDomain ? "" : `/ecommerce/${data.tenant.slug}`;

  // Para tiendas multisucursal: cargamos las otras sucursales de la marca para mostrarlas en pickup.
  // Usamos loadBrandSlugForSlug como fallback porque el cache puede no tener brandSlug aún.
  let siblings: BrandBranch[] = [];
  const brandSlug = data.tenant.brandSlug || await loadBrandSlugForSlug(slug);
  if (brandSlug) {
    const brand = await loadEcommerceBrand(brandSlug);
    if (brand) siblings = brand.branches.filter((b) => b.id !== data.tenant.id && !b.hidden);
  }

  const gtm = <GtmScript id={data.tenant.gtmId} />;
  const metaPixel = <MetaPixelScript id={data.tenant.metaPixelId} />;
  // PWA instalable solo en dominio propio (scope "/"); en el dominio principal la tienda sigue como web.
  const pwa = <StorePwa enabled={basePath === ""} />;
  const hit = <PageHitTracker restaurantId={data.tenant.id} page="ecommerce" />;
  // Sincroniza la cookie qc_app: si corre dentro de la app, la activa (y refresca
  // una vez) para que aparezcan los platos exclusivos; si no, no hace nada.
  const appSync = <>{<AppFlagSync active={fromApp} />}{fromApp && <AppPushRegister restaurantId={data.tenant.id} />}{fromApp && <AppPushOptIn restaurantId={data.tenant.id} brandColor={data.tenant.primaryColor} />}</>;
  // Datos estructurados para que Google muestre las fotos de los productos.
  const jsonLd = <StoreJsonLd tenant={data.tenant} categories={data.categories} products={data.products} />;
  const effectiveTheme = themeOverride || data.tenant.theme;
  if (effectiveTheme === "modern") {
    return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<ModernStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} /></>;
  }
  if (effectiveTheme === "impact") {
    return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<ImpactStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} /></>;
  }
  return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<StoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} /></>;
}
