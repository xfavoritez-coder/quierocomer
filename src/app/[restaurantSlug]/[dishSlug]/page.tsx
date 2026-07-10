import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'
import { getFeedDishes, getDishesById } from '@/app/a/lib/feed-queries'
import NewHome from '@/app/a/preview/NewHome'
import FeedLayout from '@/app/a/layout'

const BASE = 'https://quierocomer.cl'

type Props = { params: Promise<{ restaurantSlug: string; dishSlug: string }> }

// ---------------------------------------------------------------------------
// Category slug map
// ---------------------------------------------------------------------------

const CATEGORY_SLUGS: Record<string, string> = {
  'sushi': 'Sushi',
  'pizza': 'Pizza',
  'burger': 'Burger',
  'ramen': 'Ramen',
  'pasta': 'Pasta',
  'tacos': 'Tacos',
  'empanadas': 'Empanadas',
  'mariscos': 'Mariscos',
  'pollo': 'Pollo',
  'helados': 'Helados',
  'cafe': 'Café',
  'postres': 'Postres',
  'ensaladas': 'Ensaladas',
  'sandwiches': 'Sándwiches',
  'churrascos': 'Churrascos',
}

// ---------------------------------------------------------------------------
// Commune detection helpers
// ---------------------------------------------------------------------------

const communeCache = unstable_cache(
  async (communeSlug: string) => {
    return prisma.restaurant.findFirst({
      where: { communeSlug, isActive: true, isDemo: false },
      select: { commune: true, communeSlug: true },
    })
  },
  ['commune-by-slug'],
  { revalidate: 3600 }
)

const restaurantInCommuneCache = unstable_cache(
  async (communeSlug: string, restaurantSlug: string) => {
    return prisma.restaurant.findFirst({
      where: { slug: restaurantSlug, communeSlug, isActive: true, isDemo: false },
      select: {
        id: true, slug: true, name: true, logoUrl: true, address: true,
        primaryCategory: true, googleRating: true, googleRatingCount: true,
        googleMapsUrl: true, website: true, phone: true,
      },
    })
  },
  ['restaurant-in-commune'],
  { revalidate: 3600 }
)

async function getCommuneDishesByCategory(communeSlug: string, categorySlug: string, categoryLabel: string) {
  return prisma.dish.findMany({
    where: {
      isActive: true,
      hiddenFromFeed: false,
      deletedAt: null,
      OR: [
        { txCuisine: { has: categorySlug } },
        { txDishType: { has: categorySlug } },
        { txCuisine: { has: categoryLabel } },
        { txDishType: { has: categoryLabel } },
      ],
      restaurant: { communeSlug, isActive: true, isDemo: false },
    },
    select: {
      id: true, name: true, price: true, photos: true, dishDiet: true,
      restaurant: { select: { name: true, slug: true } },
    },
    orderBy: { position: 'asc' },
    take: 80,
  })
}

async function getCommuneDishesFiltered(communeSlug: string, dietFilter?: 'VEGAN' | 'VEGETARIAN') {
  return prisma.dish.findMany({
    where: {
      isActive: true,
      hiddenFromFeed: false,
      deletedAt: null,
      ...(dietFilter ? { dishDiet: dietFilter } : {}),
      restaurant: { communeSlug, isActive: true, isDemo: false },
    },
    select: {
      id: true, name: true, price: true, photos: true, dishDiet: true,
      restaurant: { select: { name: true, slug: true } },
    },
    orderBy: { position: 'asc' },
    take: 80,
  })
}

async function getRestaurantDishes(restaurantSlug: string) {
  return prisma.dish.findMany({
    where: {
      isActive: true,
      hiddenFromFeed: false,
      deletedAt: null,
      restaurant: { slug: restaurantSlug, isActive: true, isDemo: false },
    },
    select: {
      id: true, name: true, price: true, photos: true, dishDiet: true, description: true,
      category: { select: { name: true } },
    },
    orderBy: { position: 'asc' },
    take: 60,
  })
}

// ---------------------------------------------------------------------------
// Sub-page components
// ---------------------------------------------------------------------------

function DishGrid({
  dishes,
  label,
}: {
  dishes: Array<{ id: string; name: string; price: number; photos: string[]; dishDiet: string; restaurant: { name: string; slug: string } }>
  label: string
}) {
  if (!dishes.length) return <p className="text-zinc-500 dark:text-zinc-400">{label} Aún no hay platos cargados.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {dishes.map(dish => (
        <Link
          key={dish.id}
          href={`/${dish.restaurant.slug}/${slugify(dish.name)}`}
          className="group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow bg-white dark:bg-zinc-900"
        >
          <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
            {dish.photos[0] ? (
              <Image
                src={dish.photos[0]}
                alt={dish.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-300">🍽</div>
            )}
            {dish.dishDiet === 'VEGAN' && (
              <span className="absolute top-1.5 left-1.5 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-medium">V</span>
            )}
            {dish.dishDiet === 'VEGETARIAN' && (
              <span className="absolute top-1.5 left-1.5 text-xs bg-lime-600 text-white px-1.5 py-0.5 rounded-full font-medium">Veg</span>
            )}
          </div>
          <div className="p-2.5">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-snug">{dish.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{dish.restaurant.name}</p>
            <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mt-1">
              ${dish.price.toLocaleString('es-CL')}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}

async function VeganCommunePage({ communeSlug, commune }: { communeSlug: string; commune: string }) {
  const dishes = await getCommuneDishesFiltered(communeSlug, 'VEGAN')

  const title = `Opciones veganas en ${commune} — QuieroComer`
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: dishes.length,
    itemListElement: dishes.slice(0, 20).map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: d.name,
      url: `${BASE}/${d.restaurant.slug}/${slugify(d.name)}`,
    })),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'QuieroComer.cl', item: BASE },
      { '@type': 'ListItem', position: 2, name: commune, item: `${BASE}/${communeSlug}` },
      { '@type': 'ListItem', position: 3, name: 'Vegano', item: `${BASE}/${communeSlug}/vegano` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              <Link href="/" className="hover:underline">QuieroComer.cl</Link>
              {' › '}<Link href={`/${communeSlug}`} className="hover:underline">{commune}</Link>
              {' › '}Vegano
            </p>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Comida vegana en {commune}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              {dishes.length} plato{dishes.length !== 1 ? 's' : ''} vegano{dishes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <DishGrid dishes={dishes} label="Veganos en esta comuna:" />
        </div>
      </main>
    </>
  )
}

async function VegetarianCommunePage({ communeSlug, commune }: { communeSlug: string; commune: string }) {
  const dishes = await getCommuneDishesFiltered(communeSlug, 'VEGETARIAN')

  const title = `Opciones vegetarianas en ${commune} — QuieroComer`
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: dishes.length,
    itemListElement: dishes.slice(0, 20).map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: d.name,
      url: `${BASE}/${d.restaurant.slug}/${slugify(d.name)}`,
    })),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'QuieroComer.cl', item: BASE },
      { '@type': 'ListItem', position: 2, name: commune, item: `${BASE}/${communeSlug}` },
      { '@type': 'ListItem', position: 3, name: 'Vegetariano', item: `${BASE}/${communeSlug}/vegetariano` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="bg-gradient-to-br from-lime-50 to-green-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              <Link href="/" className="hover:underline">QuieroComer.cl</Link>
              {' › '}<Link href={`/${communeSlug}`} className="hover:underline">{commune}</Link>
              {' › '}Vegetariano
            </p>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Comida vegetariana en {commune}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              {dishes.length} plato{dishes.length !== 1 ? 's' : ''} vegetariano{dishes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <DishGrid dishes={dishes} label="Vegetarianos en esta comuna:" />
        </div>
      </main>
    </>
  )
}

async function CategoryCommunePage({
  communeSlug,
  commune,
  categorySlug,
}: {
  communeSlug: string
  commune: string
  categorySlug: string
}) {
  const categoryLabel = CATEGORY_SLUGS[categorySlug]!
  const dishes = await getCommuneDishesByCategory(communeSlug, categorySlug, categoryLabel)

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${categoryLabel} en ${commune}`,
    numberOfItems: dishes.length,
    itemListElement: dishes.slice(0, 20).map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: d.name,
      url: `${BASE}/${d.restaurant.slug}/${slugify(d.name)}`,
    })),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'QuieroComer.cl', item: BASE },
      { '@type': 'ListItem', position: 2, name: commune, item: `${BASE}/${communeSlug}` },
      { '@type': 'ListItem', position: 3, name: categoryLabel, item: `${BASE}/${communeSlug}/${categorySlug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              <Link href="/" className="hover:underline">QuieroComer.cl</Link>
              {' › '}<Link href={`/${communeSlug}`} className="hover:underline">{commune}</Link>
              {' › '}{categoryLabel}
            </p>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              {categoryLabel} en {commune}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              {dishes.length} plato{dishes.length !== 1 ? 's' : ''} encontrado{dishes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <DishGrid dishes={dishes} label={`${categoryLabel} en ${commune}:`} />
        </div>
      </main>
    </>
  )
}

async function RestaurantInCommunePage({
  restaurant,
  commune,
  communeSlug,
}: {
  restaurant: NonNullable<Awaited<ReturnType<typeof restaurantInCommuneCache>>>
  commune: string
  communeSlug: string
}) {
  const dishes = await getRestaurantDishes(restaurant.slug)

  const restaurantLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url: `${BASE}/${communeSlug}/${restaurant.slug}`,
    address: restaurant.address
      ? { '@type': 'PostalAddress', streetAddress: restaurant.address, addressLocality: commune, addressCountry: 'CL' }
      : undefined,
    ...(restaurant.logoUrl ? { image: restaurant.logoUrl } : {}),
    ...(restaurant.googleRating
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: restaurant.googleRating, reviewCount: restaurant.googleRatingCount ?? 1 } }
      : {}),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'QuieroComer.cl', item: BASE },
      { '@type': 'ListItem', position: 2, name: commune, item: `${BASE}/${communeSlug}` },
      { '@type': 'ListItem', position: 3, name: restaurant.name, item: `${BASE}/${communeSlug}/${restaurant.slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              <Link href="/" className="hover:underline">QuieroComer.cl</Link>
              {' › '}<Link href={`/${communeSlug}`} className="hover:underline">{commune}</Link>
              {' › '}{restaurant.name}
            </p>
            <div className="flex items-center gap-4">
              {restaurant.logoUrl && (
                <Image src={restaurant.logoUrl} alt={restaurant.name} width={64} height={64} className="rounded-xl object-cover w-16 h-16 border border-zinc-200 dark:border-zinc-700" />
              )}
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{restaurant.name}</h1>
                {restaurant.address && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{restaurant.address}</p>}
                {restaurant.googleRating && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                    ★ {restaurant.googleRating.toFixed(1)}
                    {restaurant.googleRatingCount ? ` (${restaurant.googleRatingCount.toLocaleString('es-CL')} reseñas)` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              {restaurant.googleMapsUrl && (
                <a href={restaurant.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Ver en Google Maps
                </a>
              )}
              {restaurant.website && (
                <a href={restaurant.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm px-3 py-1.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                  Pedir online
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-4">
            Platos de {restaurant.name}
          </h2>
          {dishes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {dishes.map(dish => (
                <Link
                  key={dish.id}
                  href={`/${restaurant.slug}/${slugify(dish.name)}`}
                  className="group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow bg-white dark:bg-zinc-900"
                >
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                    {dish.photos[0] ? (
                      <Image
                        src={dish.photos[0]}
                        alt={dish.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-300">🍽</div>
                    )}
                    {dish.dishDiet === 'VEGAN' && (
                      <span className="absolute top-1.5 left-1.5 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-medium">V</span>
                    )}
                    {dish.dishDiet === 'VEGETARIAN' && (
                      <span className="absolute top-1.5 left-1.5 text-xs bg-lime-600 text-white px-1.5 py-0.5 rounded-full font-medium">Veg</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-snug">{dish.name}</p>
                    {dish.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{dish.description}</p>
                    )}
                    <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mt-1">
                      ${dish.price.toLocaleString('es-CL')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400">Aún no hay platos cargados para este restaurante.</p>
          )}
        </div>
      </main>
    </>
  )
}

// ---------------------------------------------------------------------------
// Cached 5 min — evita double-query entre generateMetadata y el page component
// ---------------------------------------------------------------------------

const findDishCached = unstable_cache(
  async (restaurantSlug: string, dishSlug: string) => {
    const dishes = await prisma.dish.findMany({
      where: { restaurant: { slug: restaurantSlug }, isActive: true },
      select: {
        id: true, name: true, description: true, price: true, photos: true,
        restaurant: { select: { name: true, address: true, logoUrl: true } },
      },
    })
    return dishes.find(d => slugify(d.name) === dishSlug) ?? null
  },
  ['dish-slug'],
  { revalidate: 300 }
)

// ---------------------------------------------------------------------------
// generateStaticParams — both dish entries AND commune+restaurant combos
// ---------------------------------------------------------------------------

// Empty — pages generated on-demand via ISR (avoids connection pool exhaustion at build time)
export async function generateStaticParams() {
  return []
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug, dishSlug } = await params

  // Check if restaurantSlug is a communeSlug
  const commune = await communeCache(restaurantSlug)
  if (commune) {
    const communeName = commune.commune!
    const lowerDish = dishSlug.toLowerCase()

    if (lowerDish === 'vegano' || lowerDish === 'vegana') {
      return {
        title: `Comida vegana en ${communeName} — QuieroComer`,
        description: `Platos veganos en restaurantes de ${communeName}. Opciones plant-based con fotos y precios.`,
        alternates: { canonical: `${BASE}/${restaurantSlug}/vegano` },
      }
    }
    if (lowerDish === 'vegetariano' || lowerDish === 'vegetariana') {
      return {
        title: `Comida vegetariana en ${communeName} — QuieroComer`,
        description: `Platos vegetarianos en restaurantes de ${communeName}. Opciones sin carne con fotos y precios.`,
        alternates: { canonical: `${BASE}/${restaurantSlug}/vegetariano` },
      }
    }

    // Check if dishSlug is a category
    if (CATEGORY_SLUGS[dishSlug]) {
      const categoryLabel = CATEGORY_SLUGS[dishSlug]
      const title = `${categoryLabel} en ${communeName} · QuieroComer.cl`
      const description = `Los mejores platos de ${categoryLabel.toLowerCase()} en restaurantes de ${communeName}. Fotos reales y precios actualizados.`
      return {
        title,
        description,
        alternates: { canonical: `${BASE}/${restaurantSlug}/${dishSlug}` },
        openGraph: {
          title,
          description,
          url: `${BASE}/${restaurantSlug}/${dishSlug}`,
          type: 'website',
          images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630 }],
        },
        twitter: { card: 'summary_large_image', title, description },
      }
    }

    // Check if dishSlug is a restaurant in this commune
    const restaurant = await restaurantInCommuneCache(restaurantSlug, dishSlug)
    if (restaurant) {
      const title = `${restaurant.name} en ${communeName} — QuieroComer`
      const description = `Carta de ${restaurant.name} en ${communeName}. Ver platos, precios y pedir online.`
      return {
        title,
        description,
        alternates: { canonical: `${BASE}/${restaurantSlug}/${dishSlug}` },
        openGraph: {
          title,
          description,
          url: `${BASE}/${restaurantSlug}/${dishSlug}`,
          type: 'website',
          images: restaurant.logoUrl
            ? [{ url: restaurant.logoUrl, width: 400, height: 400 }]
            : [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630 }],
        },
        twitter: { card: 'summary_large_image', title, description },
      }
    }

    // commune slug matched but dishSlug doesn't match anything — fall through to dish lookup
  }

  // Original dish metadata
  const dish = await findDishCached(restaurantSlug, dishSlug)
  if (!dish) return { title: 'Plato no encontrado — QuieroComer' }

  const title = `${dish.name} en ${dish.restaurant.name} — QuieroComer`
  const description = dish.description || `${dish.name} · $${dish.price.toLocaleString('es-CL')} · ${dish.restaurant.name}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(dish.photos[0] ? { images: [{ url: dish.photos[0] }] } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function DishSlugPage({ params }: Props) {
  const { restaurantSlug, dishSlug } = await params

  // --- Commune detection ---
  const communeMatch = await communeCache(restaurantSlug)
  if (communeMatch) {
    const commune = communeMatch.commune!
    const communeSlug = communeMatch.communeSlug!
    const lowerDish = dishSlug.toLowerCase()

    if (lowerDish === 'vegano' || lowerDish === 'vegana') {
      return <VeganCommunePage communeSlug={communeSlug} commune={commune} />
    }
    if (lowerDish === 'vegetariano' || lowerDish === 'vegetariana') {
      return <VegetarianCommunePage communeSlug={communeSlug} commune={commune} />
    }

    // Check if dishSlug is a category
    if (CATEGORY_SLUGS[dishSlug]) {
      return <CategoryCommunePage communeSlug={communeSlug} commune={commune} categorySlug={dishSlug} />
    }

    const restaurant = await restaurantInCommuneCache(communeSlug, dishSlug)
    if (restaurant) {
      return <RestaurantInCommunePage restaurant={restaurant} commune={commune} communeSlug={communeSlug} />
    }

    // dishSlug not recognized under this commune → 404
    notFound()
  }

  // --- Original dish page logic ---
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value
  const next = `/${restaurantSlug}/${dishSlug}`

  if (!fingerprint) redirect(`/api/feed-init?next=${next}`)

  // Queries rápidas primero — evitan competir con getFeedDishes por la conexión
  const [user, dish] = await Promise.all([
    prisma.feedUser.findUnique({
      where: { fingerprint },
      select: { id: true, categoryScores: true, keywordScores: true, totalInteractions: true },
    }),
    findDishCached(restaurantSlug, dishSlug),
  ])

  if (!user) redirect(`/api/feed-init?next=${next}`)
  if (!dish) redirect('/')

  // getFeedDishes tiene su propio unstable_cache — corre solo después de liberar la conexión anterior
  let feedDishes: Awaited<ReturnType<typeof getFeedDishes>> = []
  try {
    feedDishes = await getFeedDishes()
  } catch (err) {
    console.error('[dish-page] getFeedDishes failed:', err)
    redirect(`/qr/${restaurantSlug}`)
  }

  // Si el plato no está en el feed (MAX_PER=5 por restaurante), lo traemos explícitamente
  let dishesWithInitial = feedDishes
  try {
    dishesWithInitial = feedDishes.some(d => d.id === dish.id)
      ? feedDishes
      : [...(await getDishesById([dish.id])), ...feedDishes]
  } catch {
    dishesWithInitial = feedDishes
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: dish.name,
    description: dish.description ?? undefined,
    offers: {
      '@type': 'Offer',
      price: dish.price,
      priceCurrency: 'CLP',
      availability: 'https://schema.org/InStock',
    },
    ...(dish.photos[0] ? { image: dish.photos[0] } : {}),
    inMenu: {
      '@type': 'Menu',
      hasMenuSection: {
        '@type': 'MenuSection',
        name: dish.restaurant.name,
      },
    },
    suitableForDiet: 'https://schema.org/OmnivoreConsideration',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FeedLayout>
        <NewHome
          dishes={dishesWithInitial}
          categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
          keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
          totalInteractions={user.totalInteractions}
          initialDishId={dish.id}
        />
      </FeedLayout>
    </>
  )
}
