'use client'

// KDS (pantalla de cocina) DENTRO del POS: embebe el mismo KDS, tomando el local
// de usePosRestaurant. Es una vista fullscreen propia; el "Volver" regresa al
// Centro de pedidos del POS (dentro de la app instalada, sin abrir el navegador).
import KdsPage from '@/app/(panel)/panel/centro-pedidos/kds/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosKdsPage() {
  const { restaurantId } = usePosRestaurant()
  return <KdsPage restaurantId={restaurantId} backHref="/pos/centro-pedidos" />
}
