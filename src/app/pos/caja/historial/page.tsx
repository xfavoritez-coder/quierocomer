'use client'

import { usePosNav } from '../../lib/usePosNav'
import { usePosRestaurant } from '../../lib/usePosRestaurant'
import { usePosSync } from '@/lib/pos'
import PosHeader from '../../components/PosHeader'
import PosCajaHistorial from '../../components/PosCajaHistorial'

export default function HistorialCajaPage() {
  const navigate = usePosNav()
  const { restaurantId } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)

  return (
    <div className="pos-shell">
      <PosHeader mode="back" eyebrow="Historial de caja" subtitle="Cierres anteriores" syncing={syncing} onBack={() => navigate('/pos/caja')} />
      <div className="pos-scroll">
        <div className="pos-caja-wrap">
          <PosCajaHistorial restaurantId={restaurantId} />
        </div>
      </div>
    </div>
  )
}
