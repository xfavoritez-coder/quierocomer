import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes } from '../lib/feed-queries'
import SearchExplore from './SearchExplore'

export default async function SearchPage() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value
  if (!fingerprint) redirect('/a/onboarding')

  const user = await prisma.feedUser.findUnique({
    where: { fingerprint },
    select: {
      onboardingDone: true,
      categoryScores: true, keywordScores: true, totalInteractions: true,
    },
  })
  if (!user?.onboardingDone) redirect('/a/onboarding')

  const dishes = await getFeedDishes()

  return (
    <SearchExplore
      dishes={dishes}
      categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
      keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
    />
  )
}
