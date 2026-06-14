'use client'

import { useState, useEffect } from 'react'

const HINTS: Record<number, string> = {
  1: 'Sigue deslizando, estamos aprendiendo tus gustos',
  2: 'Ya vamos entendiendo qué te gusta',
  3: 'Estamos casi listos para recomendarte',
}

export default function EurekaHint({ hintLevel }: { hintLevel: 0 | 1 | 2 | 3 }) {
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    if (hintLevel === 0) return
    const msg = HINTS[hintLevel]
    if (!msg) return

    setText(msg)
    setVisible(true)

    const timer = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [hintLevel])

  if (!visible || !text) return null

  return (
    <div style={{
      position: 'fixed', top: 52, left: '50%', transform: 'translateX(-50%)',
      zIndex: 70, pointerEvents: 'none',
      animation: 'eurekaHintIn 0.4s ease-out',
    }}>
      <div style={{
        padding: '10px 20px', borderRadius: 24,
        background: 'rgba(14,14,14,0.85)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(244,166,35,0.15)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', gap: 8,
        maxWidth: 320,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: hintLevel === 1 ? '#f59e0b' : hintLevel === 2 ? '#F4A623' : '#4ade80',
          flexShrink: 0,
          animation: 'eurekaHintPulse 1.5s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500,
          lineHeight: 1.3,
        }}>
          {text}
        </span>
      </div>

      <style>{`
        @keyframes eurekaHintIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes eurekaHintPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
