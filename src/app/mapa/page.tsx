import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import FeedLayout from '../a/layout'

const MapaClient = dynamic(() => import('./MapaClient'), { ssr: false })

export const metadata: Metadata = {
  title: 'Mapa — QuieroComer',
  description: 'Explora restaurantes y platos cerca de ti en el mapa.',
}

export default function MapaPage() {
  return (
    <FeedLayout>
      <MapaClient />
    </FeedLayout>
  )
}
