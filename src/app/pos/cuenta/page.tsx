'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CuentaPanel from '../components/CuentaPanel'
import { usePosNav } from '../lib/usePosNav'

function CuentaPageInner() {
  const navigate = usePosNav()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('id') ?? ''
  const fromTab = searchParams.get('from') ?? 'mesas'

  return (
    <CuentaPanel
      accountId={accountId}
      fromTab={fromTab}
      isPanel={false}
      onClose={() => navigate(`/pos?tab=${fromTab}`)}
      onGoToComandero={(id) => navigate(`/pos/comandero?cuenta=${id}`)}
    />
  )
}

export default function CuentaPage() {
  return (
    <Suspense>
      <CuentaPageInner />
    </Suspense>
  )
}
