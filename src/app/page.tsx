import { getFeedDishes, getCachedCategoryCountMap } from './a/lib/feed-queries'
import NewHome from './a/preview/NewHome'
import FeedLayout from './a/layout'

export const metadata = {
  title: 'QuieroComer - Descubre que comer cerca de ti',
  description: 'Explora platos reales de restaurantes cerca de ti. Encuentra tu próximo antojo.',
  openGraph: {
    title: 'QuieroComer - Descubre que comer cerca de ti',
    description: 'Explora platos reales de restaurantes cerca de ti.',
  },
}

// ISR: página cacheada 5 minutos en CDN, sin esperar DB de usuario en SSR
// Los scores personalizados se cargan client-side en NewHome (sin bloquear el primer paint)
export const revalidate = 300

export default async function HomePage() {
  const [dishes, categoryCountMap] = await Promise.all([
    getFeedDishes(),
    getCachedCategoryCountMap(),
  ])

  return (
    <FeedLayout>
      <NewHome
        dishes={dishes}
        categoryScores={{}}
        keywordScores={{}}
        totalInteractions={0}
        categoryCountMap={categoryCountMap}
      />
    </FeedLayout>
  )
}
