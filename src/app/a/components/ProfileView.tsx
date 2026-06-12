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
  const topCategories = useMemo(() => {
    return Object.entries(profile.categoryScores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [profile.categoryScores])

  const maxScore = topCategories.length > 0 ? topCategories[0][1] : 1
  const totalLikes = profile.likedDishIds.size
  const totalSeen = profile.seenDishIds.size
  const totalPassed = profile.passedDishIds.size

  const priceRange = useMemo(() => {
    if (profile.prices.length < 5) return null
    const sorted = [...profile.prices].sort((a, b) => a - b)
    return { min: sorted[Math.floor(sorted.length * 0.2)], max: sorted[Math.floor(sorted.length * 0.8)] }
  }, [profile.prices])

  const hasData = profile.totalInteractions > 0

  if (!hasData) {
    return (
      <div style={{ padding: '80px 20px 100px', textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>👤</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 6px' }}>Tu perfil gastronómico aparecerá aquí</p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Mientras explores el feed, iremos aprendiendo tus gustos</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 16px 100px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
          Tu perfil gastronómico
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          Basado en {profile.totalInteractions} interacciones
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <StatCard value={totalSeen} label="Platos vistos" color="#F4A623" />
        <StatCard value={totalLikes} label="Me gusta" color="#ef4444" />
        <StatCard value={totalPassed} label="Pasados" color="rgba(255,255,255,0.5)" />
      </div>

      {/* Top categories */}
      {topCategories.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px' }}>
            Categorías favoritas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topCategories.map(([category, score]) => (
              <div key={category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#fff' }}>{category}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{score}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: '#F4A623', borderRadius: 3,
                    width: `${(score / maxScore) * 100}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price range */}
      {priceRange && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 16, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>
            Tu rango de precio
          </h3>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#F4A623', margin: '0 0 2px' }}>
            ${priceRange.min.toLocaleString('es-CL')} — ${priceRange.max.toLocaleString('es-CL')}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            Basado en los platos que más te interesan
          </p>
        </div>
      )}

      {/* Reset */}
      <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onReset} style={{
          width: '100%', padding: 14, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer',
        }}>
          Resetear gustos
        </button>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 10, marginTop: 8 }}>
          Esto borrará tu perfil y el feed volverá a ser diverso
        </p>
      </div>
    </div>
  )
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: '14px 8px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 20, fontWeight: 700, color, margin: '0 0 2px' }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{label}</p>
    </div>
  )
}
