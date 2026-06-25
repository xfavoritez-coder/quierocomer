import { getFeedDishes, getCachedCategoryCountMap } from './a/lib/feed-queries'
import NewHome from './a/preview/NewHome'
import FeedLayout from './a/layout'

export const metadata = {
  title: 'QuieroComer - Descubre que comer cerca de ti',
  description: 'Descubre qué comer cerca de ti.',
  openGraph: {
    title: 'QuieroComer',
    description: 'Descubre qué comer cerca de ti.',
    url: 'https://quierocomer.cl',
    siteName: 'QuieroComer',
    // imagen generada por opengraph-image.tsx (logo 300x300)
    type: 'website',
  },
}

// ISR: página cacheada 5 minutos en CDN, sin esperar DB de usuario en SSR
// Los scores personalizados se cargan client-side en NewHome (sin bloquear el primer paint)
export const revalidate = 900 // 15 min — reduce ISR writes en Vercel

export default async function HomePage() {
  const [dishes, categoryCountMap] = await Promise.all([
    getFeedDishes(),
    getCachedCategoryCountMap(),
  ])

  const totalDishCount = Object.values(categoryCountMap).reduce((s, n) => s + n, 0)

  return (
    <FeedLayout>
      <NewHome
        dishes={dishes}
        categoryScores={{}}
        keywordScores={{}}
        totalInteractions={0}
        categoryCountMap={categoryCountMap}
        totalDishCount={totalDishCount}
      />
    </FeedLayout>
  )
}
