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

  // Verify user exists in DB
  const user = await prisma.feedUser.findUnique({
    where: { fingerprint },
    select: {
      onboardingDone: true,
      isVegan: true,
      isVegetarian: true,
      isGlutenFree: true,
      isLactoseFree: true,
    },
  })

  if (!user || !user.onboardingDone) {
    redirect('/a/onboarding')
  }

  // Fetch dishes, filtered by user restrictions
  const dishes = await getFeedDishes(1500, {
    isVegan: user.isVegan,
    isVegetarian: user.isVegetarian,
    isGlutenFree: user.isGlutenFree,
    isLactoseFree: user.isLactoseFree,
  })

  return <FeedApp dishes={dishes} />
}
