import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes } from './lib/feed-queries'
import { getScoredFeed } from './lib/taste-engine'
import NewHome from './preview/NewHome'

export default async function FeedPage() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value

  if (!fingerprint) {
    redirect('/a/onboarding')
  }

  const user = await prisma.feedUser.findUnique({
    where: { fingerprint },
    select: {
      id: true,
      onboardingDone: true,
      categoryScores: true,
      keywordScores: true,
      totalInteractions: true,
    },
  })

  if (!user || !user.onboardingDone) {
    redirect('/a/onboarding')
  }

  prisma.feedUser.update({
    where: { fingerprint },
    data: { lastSeenAt: new Date() },
  }).catch(() => {})

  const dishes = await getFeedDishes()

  // pgvector: if user has enough interactions, get taste-scored feed
  let vectorScoredIds: string[] = []
  if (user.totalInteractions >= 8) {
    try {
      const scored = await getScoredFeed(user.id, 120)
      vectorScoredIds = scored.map(s => s.dishId)
    } catch (e) {
      // fallback to keyword scoring — pgvector might not have embeddings yet
    }
  }

  return (
    <NewHome
      dishes={dishes}
      categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
      keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
      totalInteractions={user.totalInteractions}
      vectorScoredIds={vectorScoredIds}
    />
  )
}
