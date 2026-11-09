'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

// Al recargar /pos/reportes, Next.js sirve esta página standalone en vez del SPA
// principal de /pos, que es el único que tiene la barra de sucursales y los tabs
// del header. La solución es redirigir al SPA con los mismos query params y un
// flag en localStorage para que abra reportes como inner page.
function Redirect() {
  const params = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('pos:restoreInnerPage', 'reportes')
    const qs = params.toString()
    window.location.replace('/pos' + (qs ? '?' + qs : ''))
  }, [params])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 14 }}>
      Cargando…
    </div>
  )
}

export default function PosReportesPage() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  )
}
