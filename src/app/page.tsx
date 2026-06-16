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
    redirect('/api/feed-init')
  }

  const [user, dishes] = await Promise.all([
    prisma.feedUser.findUnique({
      where: { fingerprint },
      select: { id: true, categoryScores: true, keywordScores: true, totalInteractions: true },
    }),
    getFeedDishes(),
  ])

  if (!user) {
    redirect('/api/feed-init')
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
