'use client'

// KDS (pantalla de cocina) DENTRO del POS: mismo HEADER del POS (PosTopBar) arriba
// y debajo el KDS, tomando el local de usePosRestaurant. Todo dentro de la app
// instalada; el "Volver" del KDS regresa al Centro de pedidos del POS.
import KdsPage from '@/app/(panel)/panel/centro-pedidos/kds/page'
import PosTopBar from '../components/PosTopBar'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosKdsPage() {
  const { restaurantId } = usePosRestaurant()
  return (
    <div className="pos-shell">
      <PosTopBar active="none" />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <KdsPage restaurantId={restaurantId} backHref="/pos/centro-pedidos" embedded />
      </div>
    </div>
  )
}
