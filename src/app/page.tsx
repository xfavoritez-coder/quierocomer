import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFeedDishes } from './a/lib/feed-queries'
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
      select: { id: true, categoryScores: true, keywordScores: true, totalInteractions: true },
    }),
    getFeedDishes(),
  ])

  if (!user) {
    await prisma.feedUser.create({ data: { fingerprint: fingerprint!, onboardingDone: true } })
    redirect('/a')
  }

  prisma.feedUser.update({ where: { fingerprint }, data: { lastSeenAt: new Date() } }).catch(() => {})

  return (
    <FeedLayout>
      <NewHome
        dishes={dishes}
        categoryScores={(user.categoryScores as Record<string, number>) ?? {}}
        keywordScores={(user.keywordScores as Record<string, number>) ?? {}}
        totalInteractions={user.totalInteractions}
      />
    </FeedLayout>
  )
}
