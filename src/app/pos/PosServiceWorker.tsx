'use client'

import { useEffect } from 'react'

export default function PosServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/pos/sw.js', { scope: '/pos' })
        .then((reg) => {
          console.log('[POS] SW registered, scope:', reg.scope)
        })
        .catch((err) => {
          console.warn('[POS] SW registration failed:', err)
        })
    }
  }, [])

  return null
}
