import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes } from './lib/feed-queries'
import NewHome from './preview/NewHome'

export default async function FeedPage() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get('qc_feed_user')?.value

  if (!fingerprint) {
    // Auto-create user without onboarding — diet filters are in the feed
    const newFingerprint = crypto.randomUUID()
    const cookieStoreWrite = await cookies()
    cookieStoreWrite.set('qc_feed_user', newFingerprint, {
      httpOnly: false, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 365 * 24 * 60 * 60, path: '/',
    })
    await prisma.feedUser.create({ data: { fingerprint: newFingerprint, onboardingDone: true } })
    redirect('/a')
  }

  // Parallel: fetch user + dishes at the same time
  const [user, dishes] = await Promise.all([
    prisma.feedUser.findUnique({
      where: { fingerprint },
      select: {
        id: true,
        categoryScores: true,
        keywordScores: true,
        totalInteractions: true,
      },
    }),
    getFeedDishes(),
  ])

  if (!user) {
    // User cookie exists but user was deleted — recreate
    await prisma.feedUser.create({ data: { fingerprint: fingerprint!, onboardingDone: true } })
    redirect('/a')
  }

  // Fire-and-forget: update lastSeenAt
  prisma.feedUser.update({
    where: { fingerprint },
    data: { lastSeenAt: new Date() },
  }).catch(() => {})

  return (
    <NewHome
      dishes={dishes}
      categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
      keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
      totalInteractions={user.totalInteractions}
    />
  )
}
