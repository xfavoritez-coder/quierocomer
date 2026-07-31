import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const BASE = 'https://quierocomer.com'

export const revalidate = 3600

type Props = { params: Promise<{ restaurantSlug: string }> }

// ---------------------------------------------------------------------------
// Restaurant landing data
// ---------------------------------------------------------------------------

async function getRestaurantLanding(slug: string) {
  const r = await prisma.restaurant.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      orderingEnabled: true,
      primaryCategory: true,
      address: true,
      commune: true,
      googleReviewUrl: true,
      reviewReward: true,
      reviewMode: true,
    },
  })
  if (!r) return null
  const loyaltyProgram = await prisma.loyaltyProgram.findUnique({
    where: { restaurantId: r.id },
    select: { active: true, name: true, stampIcon: true },
  })
  return { ...r, loyaltyProgram }
}

// ---------------------------------------------------------------------------
// Restaurant landing page component
// ---------------------------------------------------------------------------

const BTN = {
  display: 'flex', alignItems: 'center', gap: 16,
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 18, padding: '18px 20px', textDecoration: 'none', color: '#fff',
  minHeight: 80,
} as const

function RestaurantLanding({ r }: { r: NonNullable<Awaited<ReturnType<typeof getRestaurantLanding>>> }) {
  const initials = r.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const hasLoyalty = !!r.loyaltyProgram?.active
  const loyaltyIcon = r.loyaltyProgram?.stampIcon || '★'

  return (
    <main style={{
      minHeight: '100svh',
      background: 'linear-gradient(160deg, #111 0%, #1c1c1c 60%, #0e0e0e 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 20px 60px', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* Logo */}
      <div style={{ marginBottom: 20 }}>
        {r.logoUrl ? (
          <img src={r.logoUrl} alt={r.name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.12)', display: 'block' }} />
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #F4A623, #e8920f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: '#0a0a0a' }}>{initials}</div>
        )}
      </div>

      {/* Name + category */}
      <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#fff', textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {r.name}
      </h1>
      {/* Action buttons */}
      <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
        {/* Carta — siempre visible */}
        <a href={`/qr/${r.slug}?carta=1`} style={BTN}>
          <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>📖</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>Ver carta</span>
            <span style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>Menú completo con fotos y precios</span>
          </span>
          <span style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
        </a>

        {/* Pedido online — solo si está activo */}
        {r.orderingEnabled && (
          <a href={`/pedir/${r.slug}`} style={BTN}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.85 }}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>Hacer pedido online</span>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>Elige y envía por WhatsApp</span>
            </span>
            <span style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
          </a>
        )}

        {/* Loyalty — solo si programa activo */}
        {hasLoyalty && (
          <a href={`/fidelidad/${r.slug}`} style={BTN}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🎁</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>Tarjeta de premios</span>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>Junta sellos y gana premios</span>
            </span>
            <span style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
          </a>
        )}

        {/* Reseña Google */}
        {r.reviewMode !== 'private' && r.reviewMode !== 'off' && r.googleReviewUrl && (
          <a href={r.googleReviewUrl} target="_blank" rel="noopener noreferrer" style={BTN}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>⭐</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
                {r.reviewReward ? 'Comenta y gana' : 'Déjanos una reseña'}
              </span>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                {r.reviewReward || 'Nos ayuda mucho en Google'}
              </span>
            </span>
            <span style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
          </a>
        )}

        {/* Reseña privada */}
        {r.reviewMode === 'private' && (
          <a href={`/resena/${r.slug}`} style={BTN}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>⭐</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
                {r.reviewReward ? 'Comenta y gana' : 'Déjanos tu opinión'}
              </span>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                {r.reviewReward || 'Tu opinión es privada y va directo al local'}
              </span>
            </span>
            <span style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
          </a>
        )}
      </div>

      {/* Footer */}
      <a href="https://quierocomer.com" target="_blank" rel="noopener noreferrer"
        style={{ marginTop: 48, fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textDecoration: 'none' }}>
        Powered by <strong style={{ color: 'rgba(255,255,255,0.55)' }}>QuieroComer</strong>
      </a>
    </main>
  )
}

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
  'vegano': 'Vegano',
  'vegetariano': 'Vegetariano',
  'helados': 'Helados',
  'cafe': 'Café',
  'postres': 'Postres',
  'ensaladas': 'Ensaladas',
  'sandwiches': 'Sándwiches',
  'churrascos': 'Churrascos',
}

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

async function getGlobalCategoryDishes(category: string, categoryLabel: string) {
  return prisma.dish.findMany({
    where: {
      isActive: true,
      hiddenFromFeed: false,
      deletedAt: null,
      OR: [
        { txCuisine: { has: category } },
        { txDishType: { has: category } },
        { txCuisine: { has: categoryLabel } },
        { txDishType: { has: categoryLabel } },
      ],
      restaurant: { isActive: true, isDemo: false },
    },
    select: {
      id: true,
      name: true,
      price: true,
      photos: true,
      dishDiet: true,
      restaurant: { select: { name: true, slug: true, commune: true } },
    },
    orderBy: { position: 'asc' },
    take: 100,
  })
}

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

// Empty — pages generated on-demand via ISR (avoids connection pool exhaustion at build time)
export async function generateStaticParams() {
  return []
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params

  // Check if slug is a global category
  if (CATEGORY_SLUGS[restaurantSlug]) {
    const categoryLabel = CATEGORY_SLUGS[restaurantSlug]
    const title = `${categoryLabel} en Chile · QuieroComer.cl`
    const description = `Los mejores platos de ${categoryLabel.toLowerCase()} en restaurantes de Chile. Fotos reales, precios actualizados.`
    return {
      title,
      description,
      alternates: { canonical: `${BASE}/${restaurantSlug}` },
      openGraph: {
        title,
        description,
        url: `${BASE}/${restaurantSlug}`,
        type: 'website',
        images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630 }],
      },
      twitter: { card: 'summary_large_image', title, description },
    }
  }

  // Check if slug is a restaurant
  const rest = await getRestaurantLanding(restaurantSlug)
  if (rest) {
    const title = `${rest.name} · QuieroComer`
    const description = rest.orderingEnabled
      ? `Ver la carta y hacer pedidos en ${rest.name} · Rápido, sin apps.`
      : `Ver la carta digital de ${rest.name} con fotos, precios y recomendaciones.`
    return {
      title,
      description,
      alternates: { canonical: `${BASE}/${restaurantSlug}` },
      openGraph: {
        title,
        description,
        url: `${BASE}/${restaurantSlug}`,
        type: 'website',
        images: rest.logoUrl ? [{ url: rest.logoUrl }] : [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630 }],
      },
      twitter: { card: 'summary', title, description, images: rest.logoUrl ? [rest.logoUrl] : [] },
    }
  }

  const match = await getCommuneBySlug(restaurantSlug)
  if (!match) return { title: 'QuieroComer' }

  const commune = match.commune!
  const title = `${commune} · Qué pedir · QuieroComer.cl`
  const description = `Descubre qué comer en ${commune}. Los mejores platos de restaurantes en ${commune}, con fotos, precios y opciones veganas y vegetarianas.`

  return {
    title,
    description,
    alternates: { canonical: `${BASE}/${restaurantSlug}` },
    openGraph: {
      title,
      description,
      url: `${BASE}/${restaurantSlug}`,
      type: 'website',
      images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ---------------------------------------------------------------------------
// GlobalCategoryPage component
// ---------------------------------------------------------------------------

async function GlobalCategoryPage({ categorySlug }: { categorySlug: string }) {
  const categoryLabel = CATEGORY_SLUGS[categorySlug]!
  const dishes = await getGlobalCategoryDishes(categorySlug, categoryLabel)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${categoryLabel} en Chile`,
    description: `Los mejores platos de ${categoryLabel.toLowerCase()} en restaurantes de Chile`,
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
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              <Link href="/" className="hover:underline">QuieroComer.cl</Link>
              {' › '}{categoryLabel}
            </p>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              {categoryLabel} en Chile
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              {dishes.length} plato{dishes.length !== 1 ? 's' : ''} encontrado{dishes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          {dishes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {dishes.map((dish, idx) => (
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
                        priority={idx === 0}
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
                    {dish.restaurant.commune && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{dish.restaurant.commune}</p>
                    )}
                    <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mt-1">
                      ${dish.price.toLocaleString('es-CL')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400">
              Aún no hay platos de {categoryLabel.toLowerCase()} cargados.
            </p>
          )}
        </div>
      </main>
    </>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function CommuneOrNotFoundPage({ params }: Props) {
  const { restaurantSlug } = await params

  // Check if slug is a global category
  if (CATEGORY_SLUGS[restaurantSlug]) {
    return <GlobalCategoryPage categorySlug={restaurantSlug} />
  }

  // Check if slug is a restaurant
  const rest = await getRestaurantLanding(restaurantSlug)
  if (rest) {
    const hasOrdering = rest.orderingEnabled
    const hasLoyalty = !!rest.loyaltyProgram?.active
    const hasReview = rest.reviewMode !== 'off' && (rest.reviewMode === 'private' || !!rest.googleReviewUrl)
    const activeFeatures = [hasOrdering, hasLoyalty, hasReview].filter(Boolean).length

    if (activeFeatures === 0) {
      redirect(`/qr/${restaurantSlug}`)
    }
    // Loyalty-only: ir directo al programa de sellos
    if (activeFeatures === 1 && hasLoyalty) {
      redirect(`/fidelidad/${restaurantSlug}`)
    }
    // Cualquier otro caso (ordering, review, o combinaciones) → landing
    // muestra siempre carta + las features activas
    return <RestaurantLanding r={rest} />
  }

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
                {dishes.map((dish, idx) => (
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
                          priority={idx === 0}
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
