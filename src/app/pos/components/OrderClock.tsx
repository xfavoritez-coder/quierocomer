'use client'

import { useEffect, useState } from 'react'

// Formatea una duración en ms como cronómetro: "M:SS" y "H:MM:SS" pasada 1 hora.
export function fmtElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

const ClockIcon = ({ color }: { color: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
)

/** Cronómetro en vivo: cuenta desde `since` hasta ahora, refrescando cada segundo. */
export function LiveClock({ since, icon = true, style }: {
  since: string | number | Date
  icon?: boolean
  style?: React.CSSProperties
}) {
  const start = new Date(since).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const ms = Number.isFinite(start) ? now - start : 0

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', ...style }}>
      {icon && <ClockIcon color="var(--ink-3)" />}
      {fmtElapsed(ms)}
    </span>
  )
}

/** Tiempo congelado (ya finalizado): muestra la duración total entre `from` y `to`. */
export function FrozenClock({ from, to, icon = true, style }: {
  from: string | number | Date
  to: string | number | Date
  icon?: boolean
  style?: React.CSSProperties
}) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', ...style }}>
      {icon && <ClockIcon color="var(--ink-3)" />}
      {fmtElapsed(ms)}
    </span>
  )
}
