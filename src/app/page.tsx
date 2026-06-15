import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes, getDishesById } from './a/lib/feed-queries'
import NewHome from './a/preview/NewHome'
import FeedLayout from './a/layout'

export const metadata = {
  title: 'QuieroComer — Descubre qué comer hoy',
  description: 'Explora platos reales de restaurantes cerca de ti. Encuentra tu próximo antojo.',
  openGraph: {
    title: 'QuieroComer — Descubre qué comer hoy',
    description: 'Explora platos reales de restaurantes cerca de ti.',
  },
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value

  if (!fingerprint) {
    const newFingerprint = crypto.randomUUID()
    const cookieStoreWrite = await cookies()
    cookieStoreWrite.set('qc_feed_user', newFingerprint, {
      httpOnly: false, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 365 * 24 * 60 * 60, path: '/',
    })
    await prisma.feedUser.create({ data: { fingerprint: newFingerprint, onboardingDone: true } })
    redirect('/a')
  }

  const [user, dishes] = await Promise.all([
    prisma.feedUser.findUnique({
      where: { fingerprint },
      select: {
        id: true, onboardingDone: true, categoryScores: true,
        keywordScores: true, totalInteractions: true,
        isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true,
        antojoSessionDate: true, antojoDishIds: true, antojoRejectIds: true, tasteEmbeddings: true,
      },
    }),
    getFeedDishes(),
  ])

  if (!user) {
    await prisma.feedUser.create({ data: { fingerprint: fingerprint!, onboardingDone: true } })
    redirect('/a')
  }

  prisma.feedUser.update({ where: { fingerprint }, data: { lastSeenAt: new Date() } }).catch(() => {})

  const needsVector = user.totalInteractions >= 8
  const [hasGustoVector, vectorScoredIds] = await Promise.all([
    prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`, user.id
    ).then(vr => !!vr[0]?.v).catch(() => false),
    needsVector
      ? import('./a/lib/taste-engine').then(({ getScoredFeed }) =>
          Promise.race([
            getScoredFeed(user.id, 80),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ])
        ).then(scored => scored.map(s => s.dishId)).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ])

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

  return (
    <FeedLayout>
      <NewHome
        dishes={allDishes}
        categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
        keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
        totalInteractions={user.totalInteractions}
        vectorScoredIds={vectorScoredIds}
        tasteData={{ ...tasteData }}
        userDiet={{
          isVegan: user.isVegan, isVegetarian: user.isVegetarian,
          isGlutenFree: user.isGlutenFree, isLactoseFree: user.isLactoseFree,
        }}
      />
    </FeedLayout>
  )
}
