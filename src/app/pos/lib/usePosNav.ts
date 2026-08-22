'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Navegación híbrida para el POS:
 * - Online  → router.push() (SPA instantáneo, ~50ms)
 * - Offline → location.assign() (reload desde SW cache)
 */
export function usePosNav() {
  const router = useRouter()
  return useCallback((url: string) => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      router.push(url)
    } else {
      location.assign(url)
    }
  }, [router])
}
