import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes } from './lib/feed-queries'
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
      isVegan: true,
      isVegetarian: true,
      isGlutenFree: true,
      isLactoseFree: true,
      antojoSessionDate: true,
      antojoDishIds: true,
      antojoRejectIds: true,
      tasteEmbeddings: true,
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

  // Check if user has gustoVector
  let hasGustoVector = false
  try {
    const vr = await prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`, user.id
    )
    hasGustoVector = !!vr[0]?.v
  } catch {}

  const tasteData = {
    antojoSessionDate: user.antojoSessionDate,
    antojoDishIds: (user.antojoDishIds as string[]) ?? [],
    antojoRejectIds: (user.antojoRejectIds as string[]) ?? [],
    tasteEmbeddingsCount: Array.isArray(user.tasteEmbeddings) ? user.tasteEmbeddings.length : 0,
    hasGustoVector,
  }

  const userDiet = {
    isVegan: user.isVegan,
    isVegetarian: user.isVegetarian,
    isGlutenFree: user.isGlutenFree,
    isLactoseFree: user.isLactoseFree,
  }

  // pgvector: if user has enough interactions, get taste-scored feed (with timeout)
  let vectorScoredIds: string[] = []
  if (user.totalInteractions >= 8) {
    try {
      const { getScoredFeed } = await import('./lib/taste-engine')
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      )
      const scored = await Promise.race([
        getScoredFeed(user.id, 120),
        timeoutPromise,
      ])
      vectorScoredIds = scored.map(s => s.dishId)
    } catch {
      // fallback to keyword scoring — pgvector might not have embeddings yet or timed out
    }
  }

  return (
    <NewHome
      dishes={dishes}
      categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
      keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
      totalInteractions={user.totalInteractions}
      vectorScoredIds={vectorScoredIds}
      tasteData={tasteData}
      userDiet={userDiet}
    />
  )
}
