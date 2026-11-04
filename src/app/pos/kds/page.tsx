'use client'

// KDS de cocina — pantalla completa sin header del POS.
// El KDS tiene su propio topbar con botón "Volver al POS".
import KdsPage from '@/app/(panel)/panel/centro-pedidos/kds/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosKdsPage() {
  const { restaurantId, restaurant } = usePosRestaurant()
  return <KdsPage restaurantId={restaurantId} backHref="/pos" restaurantName={restaurant?.name} restaurantCommune={restaurant?.branchName ?? undefined} />
}
