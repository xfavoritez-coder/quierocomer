'use client'

import type { CajaStep } from '@/lib/pos/cashApi'

// Paso a paso visible y obligatorio del cierre de caja:
// 1 Abrir turno · 2 Abrir caja · 3 Cerrar caja · 4 Cerrar turno.
const STEPS: { n: CajaStep; label: string }[] = [
  { n: 1, label: 'Abrir turno' },
  { n: 2, label: 'Abrir caja' },
  { n: 3, label: 'Cerrar caja' },
  { n: 4, label: 'Cerrar turno' },
]

export default function CajaStepper({ step }: { step: CajaStep }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18,
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)',
      padding: '12px 10px', overflowX: 'auto',
    }}>
      {STEPS.map((s, i) => {
        const done = s.n < step
        const active = s.n === step
        const dotBg = done ? 'var(--jade)' : active ? 'var(--amber)' : 'var(--sunk)'
        const dotColor = done || active ? '#fff' : 'var(--ink-4)'
        const dotBorder = done || active ? 'transparent' : 'var(--line-strong)'
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : '0 0 auto', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: dotBg, color: dotColor, border: `1.5px solid ${dotBorder}`,
                display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, fontFamily: 'var(--sans)',
              }}>
                {done
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : s.n}
              </span>
              <span style={{
                fontFamily: 'var(--sans)', fontSize: 12.5, whiteSpace: 'nowrap',
                fontWeight: active ? 800 : 600,
                color: active ? 'var(--ink)' : done ? 'var(--ink-2)' : 'var(--ink-4)',
              }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span style={{ flex: 1, height: 2, margin: '0 8px', borderRadius: 2, minWidth: 14, background: s.n < step ? 'var(--jade)' : 'var(--line)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
