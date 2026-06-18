import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'
import { getFeedDishes } from '@/app/a/lib/feed-queries'
import NewHome from '@/app/a/preview/NewHome'
import FeedLayout from '@/app/a/layout'

type Props = { params: Promise<{ restaurantSlug: string; dishSlug: string }> }

async function findDish(restaurantSlug: string, dishSlug: string) {
  // Single query using restaurant relation filter — avoids 2 sequential round-trips
  const dishes = await prisma.dish.findMany({
    where: { restaurant: { slug: restaurantSlug }, isActive: true, deletedAt: null },
    select: { id: true, name: true, description: true, price: true, photos: true, restaurant: { select: { name: true } } },
  })
  return dishes.find(d => slugify(d.name) === dishSlug) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug, dishSlug } = await params
  const dish = await findDish(restaurantSlug, dishSlug)

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

export default async function DishSlugPage({ params }: Props) {
  const { restaurantSlug, dishSlug } = await params
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value
  const next = `/${restaurantSlug}/${dishSlug}`

  if (!fingerprint) redirect(`/api/feed-init?next=${next}`)

  const [user, dishes, dish] = await Promise.all([
    prisma.feedUser.findUnique({
      where: { fingerprint },
      select: { id: true, categoryScores: true, keywordScores: true, totalInteractions: true },
    }),
    getFeedDishes(),
    findDish(restaurantSlug, dishSlug),
  ])

  if (!user) redirect(`/api/feed-init?next=${next}`)
  if (!dish) redirect('/')

  return (
    <FeedLayout>
      <NewHome
        dishes={dishes}
        categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
        keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
        totalInteractions={user.totalInteractions}
        initialDishId={dish.id}
      />
    </FeedLayout>
  )
}
