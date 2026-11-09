'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import { usePosNav } from '../lib/usePosNav'
import { usePosCash } from '@/lib/pos/cashApi'
import PosHeader from '../components/PosHeader'
import PosMenuDrawer from '../components/PosMenuDrawer'
import PosReportesPanel from '../components/panels/PosReportesPanel'

function ReportesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { restaurantId, restaurant, restaurants, loading } = usePosRestaurant()
  const { caja: cashSession } = usePosCash(restaurantId)
  const navigate = usePosNav()
  const [menuOpen, setMenuOpen] = useState(false)

  // Mirror branchMode logic from pos/page.tsx so multi-branch works after reload
  const [branchMode] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('pos:branchMode') || ''
  })
  const effectiveBranchMode = branchMode || restaurantId
  const allBranches = useMemo(
    () => effectiveBranchMode === 'todas' && restaurants.length > 1 ? restaurants : undefined,
    [effectiveBranchMode, restaurants]
  )

  // Auth guard
  useEffect(() => {
    if (!loading && !restaurantId) {
      window.location.href = '/pos/login'
    }
  }, [loading, restaurantId])

  const tab = searchParams.get('tab') || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined
  const chart = searchParams.get('chart') || undefined

  const handleStateChange = (tab: string, from: string, to: string, chart: string, branch: string) => {
    const params = new URLSearchParams({ tab, from, to, chart, branch })
    router.replace(`/pos/reportes?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="pos-shell">
      <PosHeader
        mode="brand"
        storeName={restaurant?.name}
        branchName={restaurant?.branchName ?? null}
        onMenu={() => setMenuOpen(true)}
      />
      {menuOpen && (
        <PosMenuDrawer
          cashSession={!!cashSession}
          restaurant={restaurant}
          onClose={() => setMenuOpen(false)}
          onNavigate={navigate}
        />
      )}
      {/* PosReportesPanel ya incluye pos-scroll */}
      {restaurantId ? (
        <PosReportesPanel
          restaurantId={restaurantId}
          allBranches={allBranches}
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
