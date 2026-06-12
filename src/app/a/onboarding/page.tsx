'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding } from '../lib/feed-actions'

const RESTRICTIONS = [
  {
    id: 'isVegan' as const,
    label: 'Vegano',
    emoji: '🌱',
    description: 'Sin productos de origen animal',
  },
  {
    id: 'isVegetarian' as const,
    label: 'Vegetariano',
    emoji: '🥬',
    description: 'Sin carne ni pescado',
  },
  {
    id: 'isGlutenFree' as const,
    label: 'Sin gluten',
    emoji: '🌾',
    description: 'Celíaco o intolerante al gluten',
  },
  {
    id: 'isLactoseFree' as const,
    label: 'Sin lactosa',
    emoji: '🥛',
    description: 'Intolerante a la lactosa',
  },
]

type RestrictionId = typeof RESTRICTIONS[number]['id']

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<RestrictionId>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleRestriction = (id: RestrictionId) => {
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

      // Force full page reload to pick up the new cookie
      window.location.href = '/a'
    } catch (e: any) {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between px-5 py-8 safe-area-inset">
      {/* Top section */}
      <div className="flex-1 flex flex-col justify-center max-w-[400px] w-full mx-auto">
        {/* Logo + tagline */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4A623]/10 mb-5">
            <span className="text-3xl">🍽</span>
          </div>
          <h1
            className="text-[28px] font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-feed-display), serif' }}
          >
            QuieroComer
          </h1>
          <p className="text-white/40 text-[15px] mt-2 leading-snug">
            Descubre platos que se te antojan<br />
            de restaurantes reales
          </p>
        </div>

        {/* Question */}
        <div className="mb-6">
          <h2 className="text-[17px] font-semibold text-white text-center">
            ¿Tienes alguna restricción?
          </h2>
        </div>

        {/* Restriction cards */}
        <div className="space-y-2.5">
          {RESTRICTIONS.map(r => {
            const isSelected = selected.has(r.id)
            return (
              <button
                key={r.id}
                onClick={() => toggleRestriction(r.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-[#F4A623]/60 bg-[#F4A623]/10'
                    : 'border-white/[0.06] bg-white/[0.03]'
                }`}
              >
                <span className="text-[26px] leading-none">{r.emoji}</span>
                <div className="text-left flex-1">
                  <p className={`font-semibold text-[15px] ${isSelected ? 'text-[#F4A623]' : 'text-white'}`}>
                    {r.label}
                  </p>
                  <p className="text-white/30 text-[13px] mt-0.5">{r.description}</p>
                </div>
                <div className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'border-[#F4A623] bg-[#F4A623]' : 'border-white/15'
                }`}
                  style={{ width: 22, height: 22 }}
                >
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center mt-4">{error}</p>
        )}
      </div>

      {/* Bottom CTA - fixed feel */}
      <div className="max-w-[400px] w-full mx-auto pt-6 pb-2 space-y-3">
        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#F4A623] text-black font-bold text-[16px] transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Preparando tu feed...
            </span>
          ) : selected.size > 0 ? (
            'Continuar'
          ) : (
            'Como de todo'
          )}
        </button>

        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="w-full py-2 text-white/25 text-[13px]"
          >
            Borrar selección
          </button>
        )}

        <p className="text-center text-white/15 text-[11px] pb-1">
          Puedes cambiar esto en tu perfil
        </p>
      </div>
    </div>
  )
}
