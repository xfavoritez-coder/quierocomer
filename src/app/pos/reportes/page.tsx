'use client'

import { useRouter } from 'next/navigation'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import PosHeader from '../components/PosHeader'
import PosReportesPanel from '../components/panels/PosReportesPanel'

export default function PosReportesPage() {
  const router = useRouter()
  const { restaurantId } = usePosRestaurant()

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Reportes"
        subtitle="Ventas del período"
        onBack={() => router.back()}
      />
      <div className="pos-scroll">
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '0 0 48px' }}>
          {restaurantId ? (
            <PosReportesPanel restaurantId={restaurantId} />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: '0.84rem' }}>
              Cargando…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
