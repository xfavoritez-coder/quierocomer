import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'

const BASE = 'https://quierocomer.cl'

// Cached 24h — Google doesn't need real-time sitemaps
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [restaurants, dishes, communeRestaurants] = await Promise.all([
    prisma.restaurant.findMany({
      where: { isActive: true, isDemo: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.dish.findMany({
      where: { isActive: true, hiddenFromFeed: false },
      select: {
        name: true,
        updatedAt: true,
        restaurant: { select: { slug: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 45000,
    }),
    // Restaurants with communes for SEO pages
    prisma.restaurant.findMany({
      where: { communeSlug: { not: null }, isActive: true, isDemo: false },
      select: { slug: true, communeSlug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/planes`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/funciones`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/descubrir`, changeFrequency: 'weekly', priority: 0.5 },
  ]

  const restaurantPages: MetadataRoute.Sitemap = restaurants.map(r => ({
    url: `${BASE}/qr/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const dishPages: MetadataRoute.Sitemap = dishes.map(d => ({
    url: `${BASE}/${d.restaurant.slug}/${slugify(d.name)}`,
    lastModified: d.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
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
    ...restaurantPages,
    ...communePages,
    ...communeRestaurantPages,
    ...dishPages,
  ]
}
