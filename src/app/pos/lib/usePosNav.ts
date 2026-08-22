'use client'

import { useCallback } from 'react'

/**
 * Navegación POS: siempre location.assign() para que el SW intercepte
 * la request como 'navigate' y sirva HTML cacheado tanto online como offline.
 * navigator.onLine es poco confiable — muchos dispositivos reportan true
 * sin internet real, causando que router.push() dispare RSC fetches que fallan.
 */
export function usePosNav() {
  return useCallback((url: string) => {
    location.assign(url)
  }, [])
}
