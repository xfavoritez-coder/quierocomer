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
import AppPushRegister from "@/components/ecommerce/AppPushRegister";
import AppPushOptIn from "@/components/ecommerce/AppPushOptIn";
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

  // /tags/[category] — metadata de categoría con fotos de sus productos
  if (path[0] === "tags" && path[1]) {
    const categorySlug = path[1];
    const category = data.categories.find((c) => slugify(c.name) === categorySlug);
    if (category) {
      const categoryProducts = data.products.filter((p) => p.category_id === category.id);
      const categoryImages = categoryProducts
        .map((p) => p.image_url)
        .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
        .slice(0, 6)
        .map((url) => ({ url }));
      const logoImage = tenant.logoUrl ? [{ url: tenant.logoUrl, width: 400, height: 400, alt: tenant.name }] : [];
      const catTitle = `${category.name} · ${tenant.name}`;
      const catDesc = `Pide ${category.name} en ${tenant.name}. ${categoryProducts.length} opciones disponibles.`;
      const catOgImages = [...categoryImages, ...logoImage];
      return {
        title: catTitle,
        description: catDesc,
        ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
        openGraph: { title: catTitle, description: catDesc, images: catOgImages, type: "website" },
        twitter: { card: "summary_large_image", title: catTitle, description: catDesc, images: catOgImages[0]?.url ? [catOgImages[0].url] : [] },
      };
    }
  }

  // Buscar el producto por slug
  const product = data.products.find((p) => slugify(p.name) === productSlug);
  const productImage = product?.image_url && /^https?:\/\//i.test(product.image_url) ? product.image_url : null;

  const prodTitle = product ? `${product.name} · ${tenant.name}` : title;
  const prodDesc = product?.description || tenant.metaDescription || `Haz tu pedido en ${tenant.name}. Rápido y fácil.`;
  const prodOgImages = [
    ...(productImage ? [{ url: productImage, width: 1200, height: 630, alt: product?.name || tenant.name }] : []),
    ...(iconUrl ? [{ url: iconUrl, width: 400, height: 400, alt: tenant.name }] : []),
  ];
  return {
    title: prodTitle,
    description: prodDesc,
    ...(iconUrl ? { icons: { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } } : {}),
    openGraph: {
      title: product ? product.name : (tenant.pageTitle || tenant.name),
      description: prodDesc,
      images: prodOgImages,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: prodTitle, description: prodDesc, images: prodOgImages[0]?.url ? [prodOgImages[0].url] : [] },
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
    // Ruta /ecommerce/{branchSlug}/local en dominio de marca → storefront de la sucursal con vista ficha
    if (path.length >= 2 && path[path.length - 1] === "local") {
      const branchSlug = path[path.length - 2];
      const branchData = await getEcommerceStorefront(branchSlug, { fromApp });
      if (branchData) {
        const basePath = `/ecommerce/${branchSlug}`;
        const theme = branchData.tenant.theme;
        return (
          <>
            <StoreJsonLd tenant={branchData.tenant} categories={branchData.categories} products={branchData.products} />
            {theme === "impact"
              ? <ImpactStoreFront tenant={branchData.tenant} categories={branchData.categories} products={branchData.products} basePath={basePath} />
              : theme === "base"
              ? <StoreFront tenant={branchData.tenant} categories={branchData.categories} products={branchData.products} basePath={basePath} />
              : <ModernStoreFront tenant={branchData.tenant} categories={branchData.categories} products={branchData.products} basePath={basePath} />}
          </>
        );
      }
    }

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
    if (brand) siblings = brand.branches.filter((b) => b.id !== data.tenant.id && !b.hidden);
  }

  const gtm = <GtmScript id={data.tenant.gtmId} />;
  const metaPixel = <MetaPixelScript id={data.tenant.metaPixelId} />;
  const pwa = <StorePwa enabled={basePath === ""} />;
  const hit = <PageHitTracker restaurantId={data.tenant.id} page="ecommerce" />;
  const appSync = <>{<AppFlagSync active={fromApp} />}{fromApp && <AppPushRegister restaurantId={data.tenant.id} />}{fromApp && <AppPushOptIn restaurantId={data.tenant.id} brandColor={data.tenant.primaryColor} />}</>;
  const jsonLd = <StoreJsonLd tenant={data.tenant} categories={data.categories} products={data.products} />;

  if (data.tenant.theme === "modern") {
    return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<ModernStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} initialProductSlug={productSlug} /></>;
  }
  if (data.tenant.theme === "impact") {
    return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<ImpactStoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} initialProductSlug={productSlug} /></>;
  }
  return <>{gtm}{metaPixel}{pwa}{hit}{appSync}{jsonLd}<StoreFront tenant={data.tenant} categories={data.categories} products={data.products} basePath={basePath} siblings={siblings} initialProductSlug={productSlug} /></>;
}
