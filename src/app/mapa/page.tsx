import type { Metadata } from 'next'
import FeedLayout from '../a/layout'
import MapaClient from './MapaClient'

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
