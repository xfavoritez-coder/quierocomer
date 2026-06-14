import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes, getDishesById } from './lib/feed-queries'
import NewHome from './preview/NewHome'

export default async function FeedPage() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value

  if (!fingerprint) {
    redirect('/a/onboarding')
  }

  // Parallel: fetch user + dishes at the same time
  const [user, dishes] = await Promise.all([
    prisma.feedUser.findUnique({
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
    }),
    getFeedDishes(),
  ])

  if (!user || !user.onboardingDone) {
    redirect('/a/onboarding')
  }

  // Fire-and-forget: update lastSeenAt
  prisma.feedUser.update({
    where: { fingerprint },
    data: { lastSeenAt: new Date() },
  }).catch(() => {})

  // Parallel: gustoVector check + vector scoring (if eligible)
  const needsVector = user.totalInteractions >= 8

  const [hasGustoVector, vectorScoredIds] = await Promise.all([
    // Check gustoVector
    prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`, user.id
    ).then(vr => !!vr[0]?.v).catch(() => false),

    // Vector scoring with timeout
    needsVector
      ? import('./lib/taste-engine').then(({ getScoredFeed }) =>
          Promise.race([
            getScoredFeed(user.id, 80),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ])
        ).then(scored => scored.map(s => s.dishId)).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ])

  // Fetch personalized dishes missing from the cached pool
  const cachedIds = new Set(dishes.map(d => d.id))
  const missingIds = vectorScoredIds.filter(id => !cachedIds.has(id))
  const extraDishes = missingIds.length > 0 ? await getDishesById(missingIds) : []
  const allDishes = extraDishes.length > 0 ? [...dishes, ...extraDishes] : dishes

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

  return (
    <NewHome
      dishes={allDishes}
      categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
      keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
      totalInteractions={user.totalInteractions}
      vectorScoredIds={vectorScoredIds}
      tasteData={tasteData}
      userDiet={userDiet}
    />
  )
}
