'use client'

import { useMemo, useState } from 'react'
import type { FeedProfile } from '../lib/scoring'

type UserDiet = {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}

type DietOption = 'all' | 'isVegan' | 'isVegetarian' | 'isGlutenFree'

const DIET_OPTIONS: { id: DietOption; label: string; emoji: string }[] = [
  { id: 'all', label: 'Como de todo', emoji: '🍽' },
  { id: 'isVegan', label: 'Vegano', emoji: '🌱' },
  { id: 'isVegetarian', label: 'Vegetariano', emoji: '🥬' },
  { id: 'isGlutenFree', label: 'Sin gluten', emoji: '🌾' },
]

export default function ProfileView({
  profile,
  diet,
  onReset,
  onUpdateDiet,
}: {
  profile: FeedProfile
  diet: UserDiet
  onReset: () => void
  onUpdateDiet: (d: UserDiet) => void
}) {
  const [editingDiet, setEditingDiet] = useState(false)
  const dietToOption = (d: UserDiet): DietOption => {
    if (d.isVegan) return 'isVegan'
    if (d.isVegetarian) return 'isVegetarian'
    if (d.isGlutenFree) return 'isGlutenFree'
    return 'all'
  }
  const [tempOption, setTempOption] = useState<DietOption>(dietToOption(diet))

  // Categories that are too generic to show as "favorites"
  const GENERIC_CATEGORIES = new Set([
    'Platos de fondo', 'Desayunos', 'Cafetería', 'Postres', 'Combos',
    'Acompañamientos', 'Extras', 'Entradas',
  ])

  const topCategories = useMemo(() => {
    return Object.entries(profile.categoryScores)
      .filter(([cat, score]) => score > 0 && !GENERIC_CATEGORIES.has(cat))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [profile.categoryScores])

  const maxScore = topCategories.length > 0 ? topCategories[0][1] : 1

  const JUNK_WORDS = new Set([
    'salsa', 'salsas', 'blanco', 'blanca', 'negro', 'negra', 'rojo', 'roja', 'verde',
    'amarillo', 'amarilla', 'dorado', 'dorada', 'base', 'envuelto', 'envuelta',
    'cubierto', 'cubierta', 'relleno', 'rellena', 'pan', 'masa', 'harina', 'aceite', 'sal',
    'arroz', 'papas', 'papa', 'queso', 'crema', 'leche', 'huevo', 'huevos',
    'carne', 'pollo', 'pescado', 'verduras', 'lechuga', 'tomate', 'cebolla',
    'casa', 'toque', 'punto', 'opcion',
  ])

  const topKeywords = useMemo(() => {
    return Object.entries(profile.keywordScores)
      .filter(([kw, score]) => score >= 4 && !JUNK_WORDS.has(kw))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [profile.keywordScores])

  const totalLikes = profile.likedDishIds.size
  const totalSeen = profile.seenDishIds.size
  const totalPassed = profile.passedDishIds.size

  const priceRange = useMemo(() => {
    if (profile.prices.length < 5) return null
    const sorted = [...profile.prices].sort((a, b) => a - b)
    return { min: sorted[Math.floor(sorted.length * 0.2)], max: sorted[Math.floor(sorted.length * 0.8)] }
  }, [profile.prices])

  const currentOption = dietToOption(diet)
  const currentLabel = DIET_OPTIONS.find(o => o.id === currentOption)

  const handleSaveDiet = () => {
    const newDiet: UserDiet = {
      isVegan: tempOption === 'isVegan',
      isVegetarian: tempOption === 'isVegetarian',
      isGlutenFree: tempOption === 'isGlutenFree',
      isLactoseFree: false,
    }
    onUpdateDiet(newDiet)
    setEditingDiet(false)
  }

  return (
    <div style={{ padding: '8px 16px 100px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
          Tu perfil gastronómico
        </h2>
        {profile.totalInteractions > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
            Basado en {profile.totalInteractions} interacciones
          </p>
        )}
      </div>

      {/* Diet restrictions */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: 16, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Restricciones alimentarias
          </h3>
          <button onClick={() => { setTempOption(dietToOption(diet)); setEditingDiet(!editingDiet) }} style={{
            background: 'none', border: 'none', color: '#F4A623', fontSize: 13, cursor: 'pointer', fontWeight: 600,
          }}>
            {editingDiet ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {!editingDiet ? (
          <p style={{ fontSize: 14, color: '#fff', margin: 0 }}>
            {currentLabel ? `${currentLabel.emoji} ${currentLabel.label}` : '🍽 Como de todo'}
          </p>
        ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {DIET_OPTIONS.map(o => {
                const active = tempOption === o.id
                return (
                  <button key={o.id} onClick={() => setTempOption(o.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 10, border: `1px solid ${active ? 'rgba(244,166,35,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? 'rgba(244,166,35,0.08)' : 'transparent',
                      cursor: 'pointer', width: '100%', textAlign: 'left',
                    }}>
                    <span style={{ fontSize: 20 }}>{o.emoji}</span>
                    <span style={{ fontSize: 14, color: active ? '#F4A623' : '#fff', fontWeight: active ? 600 : 400 }}>
                      {o.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <button onClick={handleSaveDiet} style={{
              width: '100%', padding: 12, borderRadius: 10,
              background: '#F4A623', color: '#000', fontWeight: 700, fontSize: 14,
              border: 'none', cursor: 'pointer',
            }}>
              Guardar cambios
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {profile.totalInteractions > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            <StatCard value={totalSeen} label="Platos vistos" color="#F4A623" />
            <StatCard value={totalLikes} label="Me gusta" color="#F4A623" />
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
                        width: `${(score / maxScore) * 100}%`, transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords with ranking bars */}
          {topKeywords.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px' }}>
                Porque viste
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topKeywords.map(([kw, score]) => {
                  const maxKw = topKeywords[0][1]
                  return (
                    <div key={kw}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, color: '#F4A623' }}>{kw}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{score}</span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', background: '#F4A623', borderRadius: 3,
                          width: `${(score / maxKw) * 100}%`, transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Price range */}
          {priceRange && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: 16, marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>Tu rango de precio</h3>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#F4A623', margin: 0 }}>
                ${priceRange.min.toLocaleString('es-CL')} — ${priceRange.max.toLocaleString('es-CL')}
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
        </>
      )}

      {profile.totalInteractions === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🍽</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Explora el feed para empezar a construir tu perfil</p>
        </div>
      )}
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
