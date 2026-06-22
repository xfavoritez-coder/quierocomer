'use client'

import { useEffect } from 'react'

// Thresholds at which hints appear, with their messages
const HINTS: { threshold: number; icon: string; plain: string; withLabel: (l: string) => string }[] = [
  {
    threshold: 40,
    icon: '👀',
    plain: 'Interesante...',
    withLabel: (l) => `Interesante... ¿algo de ${l}?`,
  },
  {
    threshold: 55,
    icon: '🧭',
    plain: 'Ya vamos entendiendo qué buscas',
    withLabel: (l) => `Ya vamos entendiendo... ¿${l}?`,
  },
  {
    threshold: 70,
    icon: '🎯',
    plain: 'Casi lo tenemos...',
    withLabel: (l) => `Parece que hoy vas por ${l}`,
  },
]

export default function ConfidenceHint({
  score,
  topLabel,
  onDismiss,
}: {
  score: number
  topLabel: string | null
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2600)
    return () => clearTimeout(t)
  }, [onDismiss])

  const hint = [...HINTS].reverse().find(h => score >= h.threshold) ?? HINTS[0]
  const msg = topLabel ? hint.withLabel(topLabel) : hint.plain

  return (
    <div style={{
      position: 'fixed',
      top: 72,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 160,
      background: 'rgba(10,10,10,0.88)',
      backdropFilter: 'blur(16px)',
      borderRadius: 22,
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
      animation: 'chFadeInOut 2.6s ease forwards',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{hint.icon}</span>
      <span style={{ fontSize: 14, color: '#fff', fontWeight: 500, letterSpacing: '-0.1px' }}>{msg}</span>
      <style>{`
        @keyframes chFadeInOut {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          14%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          72%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
