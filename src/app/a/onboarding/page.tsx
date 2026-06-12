'use client'

import { useState } from 'react'
import { completeOnboarding } from '../lib/feed-actions'

const OPTIONS = [
  { id: 'all' as const, label: 'Como de todo', emoji: '🍽', desc: 'Sin restricciones' },
  { id: 'isVegan' as const, label: 'Vegano', emoji: '🌱', desc: 'Sin productos de origen animal' },
  { id: 'isVegetarian' as const, label: 'Vegetariano', emoji: '🥬', desc: 'Sin carne ni pescado' },
  { id: 'isGlutenFree' as const, label: 'Sin gluten', emoji: '🌾', desc: 'Celíaco o intolerante' },
]

type OptionId = typeof OPTIONS[number]['id']

export default function OnboardingPage() {
  const [selected, setSelected] = useState<OptionId>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await completeOnboarding({
        isVegan: selected === 'isVegan',
        isVegetarian: selected === 'isVegetarian',
        isGlutenFree: selected === 'isGlutenFree',
        isLactoseFree: false,
      })
      if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar')
        setLoading(false)
        return
      }
      window.location.href = '/a'
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="onboard-page">
      {/* Content area */}
      <div className="onboard-content">
        {/* Logo - compact, app style */}
        <div className="onboard-logo">
          <span className="onboard-logo-icon">🍽</span>
          <span className="onboard-logo-text">QuieroComer</span>
        </div>

        {/* Question */}
        <div className="onboard-question">
          <h2>¿Tienes alguna restricción alimentaria?</h2>
          <p>Filtramos el feed para ti. Si no, salta este paso.</p>
        </div>

        {/* Cards — single select */}
        <div className="onboard-options">
          {OPTIONS.map(o => {
            const sel = selected === o.id
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`onboard-card ${sel ? 'selected' : ''}`}
              >
                <span className="emoji">{o.emoji}</span>
                <div className="text">
                  <h3>{o.label}</h3>
                  <p>{o.desc}</p>
                </div>
                <div className={`onboard-check ${sel ? 'checked' : ''}`}>
                  {sel && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {error && <p className="onboard-error">{error}</p>}

        {/* Subtle hint */}
        <div style={{
          marginTop: 24, padding: '14px 16px', borderRadius: 12,
          background: 'rgba(244,166,35,0.04)', border: '1px solid rgba(244,166,35,0.08)',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>✨</span>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 }}>
            Mientras explores, iremos aprendiendo qué te gusta para mostrarte platos cada vez más afines a ti.
          </p>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="onboard-footer">
        <button onClick={handleContinue} disabled={loading} className="onboard-cta">
          {loading ? 'Preparando tu feed...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
