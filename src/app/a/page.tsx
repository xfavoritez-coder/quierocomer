import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes } from './lib/feed-queries'
import FeedApp from './components/FeedApp'

export default async function FeedPage() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value

  if (!fingerprint) {
    redirect('/a/onboarding')
  }

  const user = await prisma.feedUser.findUnique({
    where: { fingerprint },
    select: {
      onboardingDone: true,
      isVegan: true,
      isVegetarian: true,
      isGlutenFree: true,
      isLactoseFree: true,
      categoryScores: true,
      restaurantScores: true,
      keywordScores: true,
      totalInteractions: true,
      savedDishes: {
        select: { dishId: true, type: true },
      },
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

  return (
    <FeedApp
      dishes={dishes}
      userDiet={{
        isVegan: user.isVegan,
        isVegetarian: user.isVegetarian,
        isGlutenFree: user.isGlutenFree,
        isLactoseFree: user.isLactoseFree,
      }}
      savedProfile={{
        categoryScores: (user.categoryScores as Record<string, number>) ?? {},
        restaurantScores: (user.restaurantScores as Record<string, number>) ?? {},
        keywordScores: (user.keywordScores as Record<string, number>) ?? {},
        totalInteractions: user.totalInteractions,
      }}
      savedDishes={user.savedDishes}
    />
  )
}
