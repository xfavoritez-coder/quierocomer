// ═══════════════════════════════════════════════════════════
//  StoreJsonLd — datos estructurados Schema.org de la tienda
//  ecommerce, para que Google muestre las fotos de los productos
//  (rich results de Restaurant + Menu, igual que la carta QR).
//  Server component: se renderiza inline, así funciona tanto en
//  el dominio propio (handroll.cl) como en quierocomer.com/ecommerce/<slug>.
// ═══════════════════════════════════════════════════════════
import type { StoreTenant, StoreCategory, StoreProduct } from "@/lib/ecommerce/storefront-data";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

// Solo URLs absolutas http(s): las fotos y el logo se guardan ya como URL completa.
const abs = (u: string | null | undefined): string | null =>
  u && /^https?:\/\//i.test(u) ? u : null;

export default function StoreJsonLd({
  tenant,
  categories,
  products,
}: {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
}) {
  // URL canónica de la tienda: el dominio propio si existe (consolida el SEO ahí),
  // si no, la ruta en el dominio principal.
  const canonicalUrl = tenant.customDomain ? `https://${tenant.customDomain}` : `${SITE}/ecommerce/${tenant.slug}`;

  // Secciones del menú = categorías con sus productos (cada uno con foto, descripción y precio).
  const menuSections = categories
    .map((cat: StoreCategory) => {
      const catProducts = products.filter((p) => p.category_id === cat.id);
      if (catProducts.length === 0) return null;
      return {
        "@type": "MenuSection",
        name: cat.name,
        hasMenuItem: catProducts.map((p) => {
          const img = abs(p.image_url);
          return {
            "@type": "MenuItem",
            name: p.name,
            ...(p.description ? { description: p.description } : {}),
            ...(img ? { image: img } : {}),
            offers: {
              "@type": "Offer",
              price: String(Math.round(p.price)),
              priceCurrency: "CLP",
              availability: p.is_sold_out ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            },
          };
        }),
      };
    })
    .filter(Boolean);

  // Arreglo de imágenes a nivel tienda: logo + banner + fotos de productos (las
  // más que se puedan, para que Google tenga de dónde elegir). Deduplicado.
  const productPhotos = products.map((p) => abs(p.image_url)).filter((u): u is string => !!u);
  const imageArray = [...new Set([abs(tenant.logoUrl), abs(tenant.bannerUrl), ...productPhotos].filter((u): u is string => !!u))].slice(0, 25);

  // Rango de precios ($ a $$$$) a partir del promedio.
  const prices = products.map((p) => p.price).filter((n) => typeof n === "number" && n > 0);
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const priceRange = avg === 0 ? undefined : avg < 5000 ? "$" : avg < 10000 ? "$$" : avg < 20000 ? "$$$" : "$$$$";

  const sameAs = [
    tenant.instagram ? `https://www.instagram.com/${tenant.instagram.replace(/^@/, "")}` : null,
    abs(tenant.website),
  ].filter((u): u is string => !!u);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: tenant.branchName ? `${tenant.name} ${tenant.branchName}` : tenant.name,
    url: canonicalUrl,
    ...(imageArray.length ? { image: imageArray } : {}),
    ...(tenant.address
      ? { address: { "@type": "PostalAddress", streetAddress: tenant.address, addressCountry: "CL" } }
      : {}),
    ...(tenant.phone || tenant.whatsapp ? { telephone: tenant.phone || tenant.whatsapp } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(menuSections.length
      ? { hasMenu: { "@type": "Menu", name: "Menú", url: canonicalUrl, hasMenuSection: menuSections } }
      : {}),
    potentialAction: {
      "@type": "OrderAction",
      target: canonicalUrl,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE },
      { "@type": "ListItem", position: 2, name: tenant.name, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
  );
}
