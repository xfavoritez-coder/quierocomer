'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Deportes no está implementado aún — redirigir al POS principal
export default function PosDeportesPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/pos') }, [router])
  return null
}
