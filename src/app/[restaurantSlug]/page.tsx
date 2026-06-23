import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const BASE = 'https://quierocomer.cl'

export const revalidate = 3600

type Props = { params: Promise<{ restaurantSlug: string }> }

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function getCommuneBySlug(slug: string) {
  return prisma.restaurant.findFirst({
    where: { communeSlug: slug, isActive: true, isDemo: false },
    select: { commune: true, communeSlug: true },
  })
}

async function getCommuneDishes(communeSlug: string) {
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      hiddenFromFeed: false,
      deletedAt: null,
      restaurant: { communeSlug, isActive: true, isDemo: false },
    },
    select: {
      id: true,
      name: true,
      price: true,
      photos: true,
      dishDiet: true,
      restaurant: { select: { name: true, slug: true } },
    },
    orderBy: { position: 'asc' },
    take: 80,
  })
  return dishes
}

async function getCommuneRestaurants(communeSlug: string) {
  return prisma.restaurant.findMany({
    where: { communeSlug, isActive: true, isDemo: false },
    select: { id: true, slug: true, name: true, logoUrl: true, address: true, primaryCategory: true },
    orderBy: { name: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  const rows = await prisma.restaurant.findMany({
    where: { communeSlug: { not: null }, isActive: true, isDemo: false },
    select: { communeSlug: true },
    distinct: ['communeSlug'],
  })
  return rows
    .filter(r => r.communeSlug)
    .map(r => ({ restaurantSlug: r.communeSlug as string }))
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params
  const match = await getCommuneBySlug(restaurantSlug)
  if (!match) return { title: 'QuieroComer' }

  const commune = match.commune!
  const title = `${commune} · Qué pedir · QuieroComer.cl`
  const description = `Descubre qué comer en ${commune}. Los mejores platos de restaurantes en ${commune}, con fotos, precios y opciones veganas y vegetarianas.`

  return {
    title,
    description,
    alternates: { canonical: `${BASE}/${restaurantSlug}` },
    openGraph: { title, description, url: `${BASE}/${restaurantSlug}` },
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function CommuneOrNotFoundPage({ params }: Props) {
  const { restaurantSlug } = await params
  const match = await getCommuneBySlug(restaurantSlug)
  if (!match) notFound()

  const commune = match.commune!
  const communeSlug = match.communeSlug!

  const [dishes, restaurants] = await Promise.all([
    getCommuneDishes(communeSlug),
    getCommuneRestaurants(communeSlug),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Qué comer en ${commune}`,
    description: `Los mejores platos de restaurantes en ${commune}`,
    numberOfItems: dishes.length,
    itemListElement: dishes.slice(0, 20).map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: d.name,
      url: `${BASE}/${d.restaurant.slug}/${slugify(d.name)}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              <Link href="/" className="hover:underline">QuieroComer.cl</Link>
              {' › '}{commune}
            </p>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Qué comer en {commune}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              {restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''} · {dishes.length} plato{dishes.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              <Link
                href={`/${communeSlug}/vegano`}
                className="text-sm px-3 py-1.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
              >
                Opciones veganas
              </Link>
              <Link
                href={`/${communeSlug}/vegetariano`}
                className="text-sm px-3 py-1.5 rounded-full bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200 hover:bg-lime-200 dark:hover:bg-lime-800 transition-colors"
              >
                Opciones vegetarianas
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Restaurants list */}
          {restaurants.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-4">
                Restaurantes en {commune}
              </h2>
              <div className="flex flex-wrap gap-3">
                {restaurants.map(r => (
                  <Link
                    key={r.id}
                    href={`/${communeSlug}/${r.slug}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500 transition-colors bg-white dark:bg-zinc-900"
                  >
                    {r.logoUrl && (
                      <Image src={r.logoUrl} alt={r.name} width={28} height={28} className="rounded-full object-cover w-7 h-7" />
                    )}
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{r.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Dishes grid */}
          {dishes.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-4">
                Platos destacados en {commune}
              </h2>
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
                        <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-300">
                          🍽
                        </div>
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
            </section>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400">
              Aún no hay platos cargados para restaurantes en {commune}.
            </p>
          )}
        </div>
      </main>
    </>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
