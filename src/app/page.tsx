import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getFeedDishes, getCachedDishCount } from './a/lib/feed-queries'
import NewHome from './a/preview/NewHome'
import FeedLayout from './a/layout'

export const metadata = {
  title: 'QuieroComer - Descubre que comer cerca tuyo',
  description: 'Explora platos reales de restaurantes cerca de ti. Encuentra tu próximo antojo.',
  openGraph: {
    title: 'QuieroComer - Descubre que comer cerca tuyo',
    description: 'Explora platos reales de restaurantes cerca de ti.',
  },
}

export default async function HomePage() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

  // Middleware sets x-feed-fingerprint on first visit and also sets the cookie on the response.
  // This avoids the 2-redirect round trip (/ → /api/feed-init → /).
  const newFingerprint = headerStore.get('x-feed-fingerprint')
  if (newFingerprint) {
    // First-time user: create record lazily (non-blocking) and render immediately with empty scores
    prisma.feedUser.create({ data: { fingerprint: newFingerprint, onboardingDone: true } }).catch(() => {})
    const [dishes, totalDishCount] = await Promise.all([getFeedDishes(), getCachedDishCount()])
    return (
      <FeedLayout>
        <NewHome dishes={dishes} categoryScores={{}} keywordScores={{}} totalInteractions={0} totalDishCount={totalDishCount} />
      </FeedLayout>
    )
  }

  const fingerprint = cookieStore.get('qc_feed_user')?.value
  if (!fingerprint) {
    // Cookie missing (cleared manually or very old browser) — create one via API as fallback
    const [dishes, totalDishCount] = await Promise.all([getFeedDishes(), getCachedDishCount()])
    return (
      <FeedLayout>
        <NewHome dishes={dishes} categoryScores={{}} keywordScores={{}} totalInteractions={0} totalDishCount={totalDishCount} />
      </FeedLayout>
    )
  }

  const [user, dishes, totalDishCount] = await Promise.all([
    prisma.feedUser.findUnique({
      where: { fingerprint },
      select: { id: true, categoryScores: true, keywordScores: true, totalInteractions: true },
    }),
    getFeedDishes(),
    getCachedDishCount(),
  ])

  if (!user) {
    // DB record missing (purged) — recreate lazily and render with empty scores
    prisma.feedUser.create({ data: { fingerprint, onboardingDone: true } }).catch(() => {})
  } else {
    prisma.feedUser.update({ where: { fingerprint }, data: { lastSeenAt: new Date() } }).catch(() => {})
  }

  return (
    <FeedLayout>
      <NewHome
        dishes={dishes}
        categoryScores={(user?.categoryScores as Record<string, number>) ?? {}}
        keywordScores={(user?.keywordScores as Record<string, number>) ?? {}}
        totalInteractions={user?.totalInteractions ?? 0}
        totalDishCount={totalDishCount}
      />
    </FeedLayout>
  )
}
