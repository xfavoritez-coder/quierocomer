'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ComanderoPanel from '../components/ComanderoPanel'
import { usePosNav } from '../lib/usePosNav'

function ComanderoPageInner() {
  const navigate = usePosNav()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('cuenta')

  return (
    <ComanderoPanel
      accountId={accountId}
      isPanel={false}
      onClose={() => navigate('/pos')}
      onBack={() => accountId ? navigate(`/pos/cuenta?id=${accountId}`) : navigate('/pos')}
    />
  )
}

export default function ComanderoPage() {
  return (
    <Suspense>
      <ComanderoPageInner />
    </Suspense>
  )
}
