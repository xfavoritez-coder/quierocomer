import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'
import { currentHost, isMainHost } from '@/lib/seo/requestHost'

const BASE = 'https://quierocomer.com'

const CATEGORY_SLUGS = [
  'sushi', 'pizza', 'burger', 'ramen', 'pasta', 'tacos',
  'empanadas', 'mariscos', 'pollo', 'vegano', 'vegetariano',
]

// Sensible al host: en un dominio propio (handroll.cl) devuelve el sitemap de
// esa tienda; en el dominio principal, el sitemap completo del sitio.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = await currentHost()
  if (host && !isMainHost(host)) return buildCustomDomainSitemap(host)
  return buildMainSitemap()
}

// ── Sitemap de un dominio propio ──────────────────────────────
// Lista solo las URLs de esa tienda, en su propio dominio. Su canónica apunta
// aquí, por eso se excluyen del sitemap de quierocomer.com.
async function buildCustomDomainSitemap(host: string): Promise<MetadataRoute.Sitemap> {
  const origin = `https://${host}`
  const now = new Date()
  const store = await prisma.restaurant.findFirst({
    where: { isActive: true, ecommerceEnabled: true, ecommerceStoreConfig: { path: ['customDomain'], equals: host } },
    select: { updatedAt: true },
  })
  if (store) {
    return [
      { url: `${origin}/`, lastModified: store.updatedAt, changeFrequency: 'daily', priority: 1.0 },
      { url: `${origin}/checkout`, lastModified: store.updatedAt, changeFrequency: 'monthly', priority: 0.4 },
      { url: `${origin}/privacidad`, lastModified: store.updatedAt, changeFrequency: 'yearly', priority: 0.2 },
    ]
  }
  // Dominio propio de carta (u otro no reconocido): al menos su raíz.
  return [{ url: `${origin}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 }]
}

// ── Sitemap del dominio principal (cacheado 24h) ──────────────
// Google no necesita sitemaps en tiempo real; el contenido no depende del host.
const buildMainSitemap = unstable_cache(async (): Promise<MetadataRoute.Sitemap> => {
  const [restaurants, dishes, communeRestaurants, demoRestaurants, ecommerceStores] = await Promise.all([
    prisma.restaurant.findMany({
      where: { isActive: true, isDemo: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.dish.findMany({
      where: { isActive: true, hiddenFromFeed: false, appOnly: false, photos: { isEmpty: false } },
      select: {
        name: true,
        updatedAt: true,
        restaurant: { select: { slug: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8000,
    }),
    // Restaurants with communes for SEO pages
    prisma.restaurant.findMany({
      where: { communeSlug: { not: null }, isActive: true, isDemo: false },
      select: { slug: true, communeSlug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    // Demo restaurants from leads funnel (their carta QR is publicly indexed)
    prisma.restaurant.findMany({
      where: { isDemo: true, isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    // Tiendas ecommerce (pilar activo): su storefront es público e indexable.
    // Las de dominio propio van en el sitemap de su propio dominio, no aquí.
    prisma.restaurant.findMany({
      where: { ecommerceEnabled: true, isActive: true, isDemo: false },
      select: { slug: true, updatedAt: true, ecommerceStoreConfig: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}`, changeFrequency: 'daily', priority: 1.0, lastModified: now },
    { url: `${BASE}/qr`, changeFrequency: 'monthly', priority: 0.8, lastModified: now },
    { url: `${BASE}/carta-qr`, changeFrequency: 'monthly', priority: 0.8, lastModified: now },
    { url: `${BASE}/subircarta`, changeFrequency: 'monthly', priority: 0.7, lastModified: now },
    { url: `${BASE}/planes`, changeFrequency: 'monthly', priority: 0.7, lastModified: now },
    { url: `${BASE}/funciones`, changeFrequency: 'monthly', priority: 0.6, lastModified: now },
    { url: `${BASE}/descubrir`, changeFrequency: 'weekly', priority: 0.5, lastModified: now },
  ]

  // Global category pages
  const globalCategoryPages: MetadataRoute.Sitemap = CATEGORY_SLUGS.map(cat => ({
    url: `${BASE}/${cat}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const restaurantPages: MetadataRoute.Sitemap = restaurants.flatMap(r => ([
    {
      url: `${BASE}/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE}/qr/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ]))

  // Demo/funnel restaurant carta QR pages (leads that got a digital menu)
  const demoRestaurantPages: MetadataRoute.Sitemap = demoRestaurants.map(r => ({
    url: `${BASE}/qr/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const dishPages: MetadataRoute.Sitemap = dishes.map(d => ({
    url: `${BASE}/${d.restaurant.slug}/${slugify(d.name)}`,
    lastModified: d.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  // Tiendas ecommerce en el dominio principal. Las que tienen dominio propio
  // (handroll.cl) se excluyen: su canónica apunta a ese dominio y deben listarse
  // en el sitemap de su propio dominio, no en el de quierocomer.com.
  const ecommercePages: MetadataRoute.Sitemap = ecommerceStores
    .filter(r => !((r.ecommerceStoreConfig as { customDomain?: string | null } | null)?.customDomain))
    .map(r => ({
      url: `${BASE}/ecommerce/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }))

  // SEO commune pages
  const distinctCommunes = [
    ...new Map(communeRestaurants.map(r => [r.communeSlug, r])).values(),
  ]

  const communePages: MetadataRoute.Sitemap = distinctCommunes.flatMap(r => [
    {
      url: `${BASE}/${r.communeSlug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE}/${r.communeSlug}/vegano`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE}/${r.communeSlug}/vegetariano`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    // Category pages per commune
    ...CATEGORY_SLUGS.map(cat => ({
      url: `${BASE}/${r.communeSlug}/${cat}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ])

  // Commune → restaurant pages
  const communeRestaurantPages: MetadataRoute.Sitemap = communeRestaurants.map(r => ({
    url: `${BASE}/${r.communeSlug}/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    ...staticPages,
    ...globalCategoryPages,
    ...restaurantPages,
    ...demoRestaurantPages,
    ...communePages,
    ...communeRestaurantPages,
    ...dishPages,
    ...ecommercePages,
  ]
}, ['sitemap-main'], { revalidate: 86400 })
