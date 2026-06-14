'use client'

import { useMemo, useState } from 'react'
import type { FeedProfile } from '../lib/scoring'
import type { FeedDish } from '../types'

type UserDiet = {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}

type TasteData = {
  antojoSessionDate: string | null
  antojoDishIds: string[]
  antojoRejectIds: string[]
  tasteEmbeddingsCount: number
  hasGustoVector: boolean
}

type DietOption = 'all' | 'isVegan' | 'isVegetarian' | 'isGlutenFree'

const DIET_OPTIONS: { id: DietOption; label: string; emoji: string }[] = [
  { id: 'all', label: 'Como de todo', emoji: '🍽' },
  { id: 'isVegan', label: 'Vegano', emoji: '🌱' },
  { id: 'isVegetarian', label: 'Vegetariano', emoji: '🥬' },
  { id: 'isGlutenFree', label: 'Sin gluten', emoji: '🌾' },
]

const GENERIC_CATEGORIES = new Set([
  'Platos de fondo', 'Desayunos', 'Cafetería', 'Postres', 'Combos',
  'Acompañamientos', 'Extras', 'Entradas',
])

const JUNK_WORDS = new Set([
  'salsa', 'salsas', 'blanco', 'blanca', 'negro', 'negra', 'rojo', 'roja', 'verde',
  'amarillo', 'amarilla', 'dorado', 'dorada', 'base', 'envuelto', 'envuelta',
  'cubierto', 'cubierta', 'relleno', 'rellena', 'pan', 'masa', 'harina', 'aceite', 'sal',
  'arroz', 'papas', 'papa', 'queso', 'crema', 'leche', 'huevo', 'huevos',
  'carne', 'pollo', 'pescado', 'verduras', 'lechuga', 'tomate', 'cebolla',
  'casa', 'toque', 'punto', 'opcion',
])

export default function ProfileView({
  profile,
  diet,
  tasteData,
  dishes,
  onReset,
  onUpdateDiet,
}: {
  profile: FeedProfile
  diet: UserDiet
  tasteData?: TasteData
  dishes: FeedDish[]
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

  const topCategories = useMemo(() => {
    return Object.entries(profile.categoryScores)
      .filter(([cat, score]) => score > 0 && !GENERIC_CATEGORIES.has(cat))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
  }, [profile.categoryScores])

  const maxCatScore = topCategories.length > 0 ? topCategories[0][1] : 1

  const topKeywords = useMemo(() => {
    return Object.entries(profile.keywordScores)
      .filter(([kw, score]) => score >= 4 && !JUNK_WORDS.has(kw))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
  }, [profile.keywordScores])

  const maxKwScore = topKeywords.length > 0 ? topKeywords[0][1] : 1

  // Antojo dishes (liked today)
  const antojoDishes = useMemo(() => {
    if (!tasteData?.antojoDishIds?.length) return []
    const today = new Date().toISOString().slice(0, 10)
    if (tasteData.antojoSessionDate !== today) return []
    return tasteData.antojoDishIds
      .map(id => dishes.find(d => d.id === id))
      .filter(Boolean) as FeedDish[]
  }, [tasteData, dishes])

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

  // Engine status
  const engineLevel = !tasteData ? 0
    : !tasteData.hasGustoVector ? 1
    : tasteData.tasteEmbeddingsCount < 10 ? 2
    : tasteData.tasteEmbeddingsCount < 30 ? 3
    : 4

  const engineLabels = ['Sin datos', 'Iniciando', 'Aprendiendo', 'Conociéndote', 'Te conoce bien']
  const engineColors = ['rgba(255,255,255,0.2)', '#ef4444', '#f59e0b', '#F4A623', '#4ade80']

  return (
    <div style={{ padding: '8px 16px 100px' }}>
      {/* Diet — compact, just shows current + tap to change */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 14, marginBottom: 16,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{currentLabel?.emoji || '🍽'}</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
              {currentLabel?.label || 'Como de todo'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '1px 0 0' }}>Restricción alimentaria</p>
          </div>
        </div>
        <button onClick={() => setEditingDiet(!editingDiet)} style={{
          background: 'none', border: 'none', color: '#F4A623', fontSize: 13,
          cursor: 'pointer', fontWeight: 600, padding: '4px 8px',
        }}>
          Cambiar
        </button>
      </div>
      {editingDiet && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: -8,
          padding: '12px 14px', borderRadius: 14,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {DIET_OPTIONS.map(o => {
            const active = dietToOption(diet) === o.id
            return (
              <button key={o.id} onClick={() => {
                onUpdateDiet({
                  isVegan: o.id === 'isVegan',
                  isVegetarian: o.id === 'isVegetarian',
                  isGlutenFree: o.id === 'isGlutenFree',
                  isLactoseFree: false,
                })
                setEditingDiet(false)
              }} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 20,
                background: active ? 'rgba(244,166,35,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(244,166,35,0.3)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ fontSize: 14 }}>{o.emoji}</span>
                <span style={{
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? '#F4A623' : 'rgba(255,255,255,0.5)',
                }}>
                  {o.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Engine status */}
      <div style={{
        padding: '16px', borderRadius: 16, marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(244,166,35,0.08), rgba(244,166,35,0.02))',
        border: '1px solid rgba(244,166,35,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Motor de gustos</p>
              <p style={{ fontSize: 11, color: engineColors[engineLevel], margin: '2px 0 0', fontWeight: 500 }}>
                {engineLabels[engineLevel]}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#F4A623', margin: 0 }}>
              {profile.totalInteractions}
            </p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: 0 }}>interacciones</p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${engineColors[engineLevel]}, #F4A623)`,
            width: `${Math.min((engineLevel / 4) * 100, 100)}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            {tasteData?.tasteEmbeddingsCount ?? 0} platos aprendidos
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            {tasteData?.hasGustoVector ? '✓ Vector activo' : 'Sin vector aún'}
          </span>
        </div>
      </div>

      {/* Antojo de hoy */}
      {antojoDishes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤤</span> Hoy te antojaste
          </h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {antojoDishes.map(d => (
              <div key={d.id} style={{
                flexShrink: 0, width: 90, borderRadius: 10, overflow: 'hidden',
                background: 'rgba(255,255,255,0.04)',
              }}>
                {d.fotoUrl && <img src={d.fotoUrl} alt="" style={{ width: 90, height: 65, objectFit: 'cover', display: 'block' }} />}
                <p style={{ fontSize: 10, fontWeight: 500, color: '#fff', margin: 0, padding: '4px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.nombre}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top categories */}
      {topCategories.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>
            Categorías que te gustan
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topCategories.map(([cat, score]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: '#fff' }}>{cat}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{score}</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: '#F4A623', borderRadius: 3,
                    width: `${(score / maxCatScore) * 100}%`, transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords / flavors */}
      {topKeywords.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>
            Sabores e ingredientes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topKeywords.map(([kw, score]) => (
              <div key={kw}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: '#F4A623' }}>{kw}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{score}</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: 'linear-gradient(90deg, #F4A623, #f59e0b)', borderRadius: 3,
                    width: `${(score / maxKwScore) * 100}%`, transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        <StatCard value={profile.seenDishIds.size || profile.totalInteractions} label="Vistos" icon="👁" />
        <StatCard value={profile.likedDishIds.size} label="Likes" icon="👍" />
        <StatCard value={tasteData?.antojoRejectIds?.length ?? 0} label="Rechazados hoy" icon="👎" />
      </div>

      {/* Diet section removed — now at the top as chips */}

      {/* Reset */}
      <button onClick={onReset} style={{
        width: '100%', padding: 14, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer',
      }}>
        Reiniciar motor de gustos
      </button>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: 10, marginTop: 6 }}>
        Borra todo lo aprendido y el feed vuelve a ser genérico
      </p>
    </div>
  )
}

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '12px 8px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 14, margin: '0 0 2px' }}>{icon}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#F4A623', margin: '0 0 1px' }}>{value}</p>
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{label}</p>
    </div>
  )
}
