'use client'

import { useState, useEffect } from 'react'

const BREAKPOINT = 900

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINT : false
  )

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= BREAKPOINT)
    window.addEventListener('resize', handler)
    // Sincronizar en mount (por si el valor SSR difiere)
    handler()
    return () => window.removeEventListener('resize', handler)
  }, [])

  return isDesktop
}
