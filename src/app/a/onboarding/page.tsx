'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding } from '../lib/feed-actions'

const RESTRICTIONS = [
  {
    id: 'isVegan',
    label: 'Vegano',
    emoji: '🌱',
    description: 'Sin productos de origen animal',
  },
  {
    id: 'isVegetarian',
    label: 'Vegetariano',
    emoji: '🥬',
    description: 'Sin carne ni pescado',
  },
  {
    id: 'isGlutenFree',
    label: 'Sin gluten',
    emoji: '🌾',
    description: 'Celíaco o intolerante al gluten',
  },
  {
    id: 'isLactoseFree',
    label: 'Sin lactosa',
    emoji: '🥛',
    description: 'Intolerante a la lactosa',
  },
] as const

type RestrictionId = typeof RESTRICTIONS[number]['id']

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<RestrictionId>>(new Set())
  const [loading, setLoading] = useState(false)

  const toggleRestriction = (id: RestrictionId) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleContinue = async () => {
    setLoading(true)
    try {
      await completeOnboarding({
        isVegan: selected.has('isVegan'),
        isVegetarian: selected.has('isVegetarian'),
        isGlutenFree: selected.has('isGlutenFree'),
        isLactoseFree: selected.has('isLactoseFree'),
      })
      router.push('/a')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-[400px] w-full space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <h1
            className="text-3xl font-bold text-white"
            style={{ fontFamily: 'var(--font-feed-display), serif' }}
          >
            QuieroComer
          </h1>
          <p className="text-white/50 text-sm">
            Descubre platos que se te antojan
          </p>
        </div>

        {/* Question */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white">
            ¿Tienes alguna restricción alimentaria?
          </h2>
          <p className="text-white/40 text-sm mt-1">
            Esto nos ayuda a filtrar el feed para ti
          </p>
        </div>

        {/* Restriction toggles */}
        <div className="space-y-3">
          {RESTRICTIONS.map(r => {
            const isSelected = selected.has(r.id)
            return (
              <button
                key={r.id}
                onClick={() => toggleRestriction(r.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-[#F4A623] bg-[#F4A623]/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/8'
                }`}
              >
                <span className="text-2xl">{r.emoji}</span>
                <div className="text-left flex-1">
                  <p className={`font-semibold text-sm ${isSelected ? 'text-[#F4A623]' : 'text-white'}`}>
                    {r.label}
                  </p>
                  <p className="text-white/40 text-xs">{r.description}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'border-[#F4A623] bg-[#F4A623]' : 'border-white/20'
                }`}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#F4A623] text-black font-bold text-base transition-all hover:bg-[#e09a1f] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Cargando...' : selected.size > 0 ? 'Continuar' : 'Como de todo'}
          </button>

          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="w-full py-2 text-white/30 text-sm hover:text-white/50 transition-colors"
            >
              Borrar selección
            </button>
          )}
        </div>

        <p className="text-center text-white/20 text-xs">
          Puedes cambiar esto después en tu perfil
        </p>
      </div>
    </div>
  )
}
