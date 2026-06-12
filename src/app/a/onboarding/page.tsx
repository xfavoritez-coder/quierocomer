'use client'

import { useState } from 'react'
import { completeOnboarding } from '../lib/feed-actions'

const RESTRICTIONS = [
  { id: 'isVegan' as const, label: 'Vegano', emoji: '🌱', desc: 'Sin productos de origen animal' },
  { id: 'isVegetarian' as const, label: 'Vegetariano', emoji: '🥬', desc: 'Sin carne ni pescado' },
  { id: 'isGlutenFree' as const, label: 'Sin gluten', emoji: '🌾', desc: 'Celíaco o intolerante' },
  { id: 'isLactoseFree' as const, label: 'Sin lactosa', emoji: '🥛', desc: 'Intolerante a la lactosa' },
]

type RId = typeof RESTRICTIONS[number]['id']

export default function OnboardingPage() {
  const [selected, setSelected] = useState<Set<RId>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: RId) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleContinue = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await completeOnboarding({
        isVegan: selected.has('isVegan'),
        isVegetarian: selected.has('isVegetarian'),
        isGlutenFree: selected.has('isGlutenFree'),
        isLactoseFree: selected.has('isLactoseFree'),
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

        {/* Cards */}
        <div className="onboard-options">
          {RESTRICTIONS.map(r => {
            const sel = selected.has(r.id)
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                className={`onboard-card ${sel ? 'selected' : ''}`}
              >
                <span className="emoji">{r.emoji}</span>
                <div className="text">
                  <h3>{r.label}</h3>
                  <p>{r.desc}</p>
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
      </div>

      {/* Fixed bottom CTA */}
      <div className="onboard-footer">
        <button onClick={handleContinue} disabled={loading} className="onboard-cta">
          {loading ? 'Preparando tu feed...' : selected.size > 0 ? 'Continuar' : 'Como de todo'}
        </button>
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="onboard-clear">
            Borrar selección
          </button>
        )}
      </div>
    </div>
  )
}
