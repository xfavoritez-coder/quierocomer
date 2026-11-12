import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getEcommerceStorefront, getEcommerceStorefrontBaseCached, loadEcommerceBrandByDomain, loadEcommerceBrand, loadBrandSlugForSlug } from "@/lib/ecommerce/storefront-data";
import type { BrandBranch } from "@/lib/ecommerce/storefront-data";
import { requestIsFromApp } from "@/lib/ecommerce/appRequest";
import { slugify } from "@/lib/ecommerce/format";
import StoreFront from "@/components/ecommerce/StoreFront";
import BrandStore from "@/components/ecommerce/BrandStore";
import ImpactStoreFront from "@/components/ecommerce/ImpactStoreFront";
import ModernStoreFront from "@/components/ecommerce/ModernStoreFront";
import GtmScript from "@/components/ecommerce/GtmScript";
import MetaPixelScript from "@/components/ecommerce/MetaPixelScript";
import StorePwa from "@/components/ecommerce/StorePwa";
import AppFlagSync from "@/components/ecommerce/AppFlagSync";
import StoreJsonLd from "@/components/ecommerce/StoreJsonLd";
import PageHitTracker from "@/components/PageHitTracker";

export const dynamic = "force-dynamic";

/** Extrae communeSlug, categorySlug y productSlug del path.
 *  Formatos soportados:
 *  - [producto]
 *  - [commune, producto]
 *  - [commune, categoria, producto]
 */
function parsePath(path: string[]): { productSlug: string; communeSlug: string | null; categorySlug: string | null } {
  if (path.length === 1) return { productSlug: path[0], communeSlug: null, categorySlug: null };
  if (path.length === 2) return { productSlug: path[1], communeSlug: path[0], categorySlug: null };
  return { productSlug: path[path.length - 1], categorySlug: path[path.length - 2], communeSlug: path[path.length - 3] ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; path: string[] }> }): Promise<Metadata> {
  const { slug, path } = await params;
  const { productSlug } = parsePath(path);

  // Cargar datos del catálogo (cacheado)
  const key = slug; // puede ser un host (kojo.cl) o un slug (handroll)
  const data = await getEcommerceStorefrontBaseCached(key);
  if (!data) {
    // Intentar como brand domain
    const brand = slug.includes(".") ? await loadEcommerceBrandByDomain(slug) : null;
    if (!brand) return {};
    const iconUrl = brand.faviconUrl || brand.logoUrl;
    return {
      title: brand.pageTitle || `${brand.brandName} · Pedir online`,
      ...(iconUrl ? { icons: { icon: iconUrl } } : {}),
    };
  }

  const { tenant } = data;
  const iconUrl = tenant.faviconUrl || tenant.logoUrl;
  const title = tenant.pageTitle || `${tenant.name} · Pedir online`;

  // Buscar el producto por slug
  const product = data.products.find((p) => slugify(p.name) === productSlug);
  const productImage = product?.image_url && /^https?:\/\//i.test(product.image_url) ? product.image_url : null;

  return {
    title: product ? `${product.name} · ${tenant.name}` : title,
    description: product?.description || tenant.metaDescription || `Haz tu pedido en ${tenant.name}. Rápido y fácil.`,
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
    openGraph: {
      title: product ? product.name : (tenant.pageTitle || tenant.name),
      description: product?.description || tenant.metaDescription || `Haz tu pedido en ${tenant.name}.`,
      images: [
        ...(productImage ? [{ url: productImage }] : []),
        ...(iconUrl ? [{ url: iconUrl, width: 400, height: 400, alt: tenant.name }] : []),
      ],
      type: "website",
    },
  };
}

export default async function EcommerceProductPage({ params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params;
  const { productSlug, communeSlug } = parsePath(path);

  // Redirigir rutas de checkout/privacidad que caigan aquí por error
  if (path[0] === "checkout" || path[0] === "privacidad") {
    redirect(`/ecommerce/${slug}/${path.join("/")}`);
  }

  const fromApp = await requestIsFromApp();

  // ── Dominio de MARCA (ej. kojo.cl) ──────────────────────────────────
  if (slug.includes(".")) {
    const brand = await loadEcommerceBrandByDomain(slug);
    if (brand && brand.branches.length > 0) {
      const representative = await getEcommerceStorefront(brand.branches[0].slug, { fromApp });
      if (representative) {
        const basePath = "";
        return (
          <>
            <GtmScript id={brand.gtmId ?? representative.tenant.gtmId} />
            <MetaPixelScript id={brand.metaPixelId ?? representative.tenant.metaPixelId} />
            <PageHitTracker restaurantId={representative.tenant.id} page="ecommerce" />
            <StoreJsonLd tenant={representative.tenant} categories={representative.categories} products={representative.products} />
            <BrandStore brand={brand} representative={representative} basePath={basePath} initialProductSlug={productSlug} />
          </>
        );
      }
    }
  }

  // ── Tienda normal ────────────────────────────────────────────────────
  const data = await getEcommerceStorefront(slug, { fromApp });
  if (!data) return notFound();

  const basePath = data.tenant.customDomain && slug === data.tenant.customDomain ? "" : `/ecommerce/${data.tenant.slug}`;

  let siblings: BrandBranch[] = [];
  const brandSlug = data.tenant.brandSlug || await loadBrandSlugForSlug(slug);
  if (brandSlug) {
    const brand = await loadEcommerceBrand(brandSlug);
    if (brand) siblings = brand.branches.filter((b) => b.id !== data.tenant.id);
  }

  const gtm = <GtmScript id={data.tenant.gtmId} />;
  const metaPixel = <MetaPixelScript id={data.tenant.metaPixelId} />;
  const pwa = <StorePwa enabled={basePath === ""} />;
  const hit = <PageHitTracker restaurantId={data.tenant.id} page="ecommerce" />;
  const appSync = <AppFlagSync active={fromApp} />;
  const jsonLd = <StoreJsonLd tenant={data.tenant} categories={data.categories} products={data.products} />;

  if (data.tenant.theme === "modern") {
    return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<ModernStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} initialProductSlug={productSlug} /></>;
  }
  if (data.tenant.theme === "impact") {
    return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<ImpactStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} initialProductSlug={productSlug} /></>;
  }
  return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<StoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} initialProductSlug={productSlug} /></>;
}
