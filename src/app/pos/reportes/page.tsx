'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import PosHeader from '../components/PosHeader'
import PosReportesPanel from '../components/panels/PosReportesPanel'

function ReportesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { restaurantId, loading } = usePosRestaurant()

  // Auth guard — mismo patrón que la página principal del POS
  useEffect(() => {
    if (!loading && !restaurantId) {
      window.location.href = '/pos/login'
    }
  }, [loading, restaurantId])

  const tab = searchParams.get('tab') || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined
  const chart = searchParams.get('chart') || undefined

  const handleStateChange = (tab: string, from: string, to: string, chart: string) => {
    const params = new URLSearchParams({ tab, from, to, chart })
    router.replace(`/pos/reportes?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Reportes"
        subtitle="Ventas del período"
        onBack={() => router.back()}
      />
      {/* PosReportesPanel ya incluye pos-scroll — no anidar otro */}
      {restaurantId ? (
        <PosReportesPanel
          restaurantId={restaurantId}
          initialTab={tab}
          initialFrom={from}
          initialTo={to}
          initialChart={chart}
          onStateChange={handleStateChange}
        />
      ) : (
        <div className="pos-scroll">
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: '0.84rem' }}>
            Cargando…
          </div>
        </div>
      )}
    </div>
  )
}

export default function PosReportesPage() {
  return (
    <Suspense>
      <ReportesContent />
    </Suspense>
  )
}
