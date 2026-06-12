'use client'

import { useMemo } from 'react'
import type { FeedProfile } from '../lib/scoring'

export default function ProfileView({
  profile,
  onReset,
}: {
  profile: FeedProfile
  onReset: () => void
}) {
  // Top categories sorted by score
  const topCategories = useMemo(() => {
    return Object.entries(profile.categoryScores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [profile.categoryScores])

  const maxScore = topCategories.length > 0 ? topCategories[0][1] : 1

  // Stats
  const totalLikes = profile.likedDishIds.size
  const totalSeen = profile.seenDishIds.size
  const totalPassed = profile.passedDishIds.size

  // Price range
  const priceRange = useMemo(() => {
    if (profile.prices.length < 5) return null
    const sorted = [...profile.prices].sort((a, b) => a - b)
    const p20 = sorted[Math.floor(sorted.length * 0.2)]
    const p80 = sorted[Math.floor(sorted.length * 0.8)]
    return { min: p20, max: p80 }
  }, [profile.prices])

  const hasData = profile.totalInteractions > 0

  return (
    <div className="px-4 pb-24 pt-2">
      {!hasData ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-white/20 text-4xl">👤</p>
          <p className="text-white/40 text-sm">Tu perfil gastronómico aparecerá aquí</p>
          <p className="text-white/20 text-xs">
            Mientras explores el feed, iremos aprendiendo tus gustos
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-feed-display), serif' }}
            >
              Tu perfil gastronómico
            </h2>
            <p className="text-white/40 text-xs">
              Basado en {profile.totalInteractions} interacciones
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-[#F4A623] text-lg font-bold">{totalSeen}</p>
              <p className="text-white/40 text-[10px]">Platos vistos</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-red-400 text-lg font-bold">{totalLikes}</p>
              <p className="text-white/40 text-[10px]">Me gusta</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/60 text-lg font-bold">{totalPassed}</p>
              <p className="text-white/40 text-[10px]">Pasados</p>
            </div>
          </div>

          {/* Top categories */}
          {topCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 mb-3">
                Categorías favoritas
              </h3>
              <div className="space-y-2.5">
                {topCategories.map(([category, score]) => (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-sm">{category}</span>
                      <span className="text-white/30 text-xs">{score}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#F4A623] rounded-full transition-all duration-500"
                        style={{ width: `${(score / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price range */}
          {priceRange && (
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white/60 mb-1">
                Tu rango de precio
              </h3>
              <p className="text-[#F4A623] text-base font-semibold">
                ${priceRange.min.toLocaleString('es-CL')} — ${priceRange.max.toLocaleString('es-CL')}
              </p>
              <p className="text-white/30 text-xs mt-0.5">
                Basado en los platos que más te interesan
              </p>
            </div>
          )}

          {/* Reset */}
          <div className="pt-4 border-t border-white/5">
            <button
              onClick={onReset}
              className="w-full py-3 rounded-xl bg-white/5 text-white/40 text-sm hover:bg-white/10 hover:text-white/60 transition-colors"
            >
              Resetear gustos
            </button>
            <p className="text-center text-white/20 text-[10px] mt-2">
              Esto borrará tu perfil de gustos y el feed volverá a ser diverso
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
