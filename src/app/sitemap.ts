import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'

const BASE = 'https://quierocomer.com'

const CATEGORY_SLUGS = [
  'sushi', 'pizza', 'burger', 'ramen', 'pasta', 'tacos',
  'empanadas', 'mariscos', 'pollo', 'vegano', 'vegetariano',
]

// Cached 24h — Google doesn't need real-time sitemaps
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
}
