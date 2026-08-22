'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { isConfirmedOnline } from '@/lib/pos/notify'

/**
 * Navegación POS:
 * - Si el último ciclo de sync a Supabase fue exitoso hace <15s → router.push() (SPA rápido)
 * - Si no → location.assign() → SW sirve HTML cacheado (seguro offline)
 * navigator.onLine es poco confiable en móviles, por eso usamos el flag del sync.
 */
export function usePosNav() {
  const router = useRouter()
  return useCallback((url: string) => {
    if (isConfirmedOnline()) {
      router.push(url)
    } else {
      location.assign(url)
    }
  }, [router])
}
