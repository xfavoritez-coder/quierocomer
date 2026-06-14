'use client'

import { useMemo, useState } from 'react'
import type { FeedProfile } from '../lib/scoring'
import type { FeedDish } from '../types'
import { getCategoryGradient, getDisplayCategories } from '../lib/categories'

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

const CATEGORY_EMOJIS: Record<string, string> = Object.fromEntries(
  getDisplayCategories().map(c => [c.norm, c.icon])
)

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

  const topCategories = useMemo(() => {
    return Object.entries(profile.categoryScores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
  }, [profile.categoryScores])

  const maxCatScore = topCategories.length > 0 ? topCategories[0][1] : 1

  const topKeywords = useMemo(() => {
    return Object.entries(profile.keywordScores)
      .filter(([, score]) => score >= 4)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [profile.keywordScores])

  // Antojo dishes (liked in current period)
  const antojoDishes = useMemo(() => {
    if (!tasteData?.antojoDishIds?.length) return []
    return tasteData.antojoDishIds
      .map(id => dishes.find(d => d.id === id))
      .filter(Boolean) as FeedDish[]
  }, [tasteData, dishes])

  const currentOption = dietToOption(diet)
  const currentLabel = DIET_OPTIONS.find(o => o.id === currentOption)

  // Engine level & descriptions
  const interactions = profile.totalInteractions
  const learned = tasteData?.tasteEmbeddingsCount ?? 0
  const hasVector = tasteData?.hasGustoVector ?? false

  const engineLevel = !tasteData || interactions === 0 ? 0
    : !hasVector ? 1
    : learned < 10 ? 2
    : learned < 30 ? 3
    : 4

  const engineConfig = [
    { label: 'Nuevo', color: 'rgba(255,255,255,0.3)', desc: 'Empieza a explorar platos para que el motor aprenda tus gustos' },
    { label: 'Arrancando', color: '#ef4444', desc: 'Ya tenemos algunos datos, sigue explorando para mejorar las recomendaciones' },
    { label: 'Aprendiendo', color: '#f59e0b', desc: 'El motor ya detecta patrones en lo que te gusta' },
    { label: 'Afinando', color: '#F4A623', desc: 'Las recomendaciones se ajustan cada vez mejor a tus gustos' },
    { label: 'Te conoce', color: '#4ade80', desc: 'El feed está personalizado para ti' },
  ]

  const engine = engineConfig[engineLevel]

  // How it works steps
  const stepsCompleted = [
    interactions >= 1,  // step 1: interact
    interactions >= 8,  // step 2: vector activated
    hasVector,          // step 3: personalized feed
    learned >= 30,      // step 4: fully calibrated
  ]

  return (
    <div style={{ padding: '8px 16px 100px' }}>

      {/* ─── How the engine works ─── */}
      <div style={{
        padding: '16px', borderRadius: 16, marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(244,166,35,0.08), rgba(244,166,35,0.02))',
        border: '1px solid rgba(244,166,35,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Tu motor de gustos</p>
            <p style={{ fontSize: 12, color: engine.color, margin: '2px 0 0', fontWeight: 600 }}>
              {engine.label}
            </p>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 12,
            background: `${engine.color}15`, border: `1px solid ${engine.color}30`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: engine.color }}>
              {interactions}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 14px', lineHeight: 1.4 }}>
          {engine.desc}
        </p>

        {/* Progress steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Explorar platos', sub: 'Desliza para que aprenda', done: stepsCompleted[0], current: interactions, goal: 1 },
            { label: 'Motor activado', sub: `${Math.min(interactions, 8)} de 8 interacciones`, done: stepsCompleted[1], current: interactions, goal: 8 },
            { label: 'Feed personalizado', sub: hasVector ? 'Recomendaciones basadas en ti' : `${Math.min(interactions, 8)} de 8 para activar`, done: stepsCompleted[2], current: interactions, goal: 8 },
            { label: 'Totalmente calibrado', sub: `${Math.min(learned, 30)} de 30 platos aprendidos`, done: stepsCompleted[3], current: learned, goal: 30 },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: step.done ? engine.color : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.3s ease',
              }}>
                {step.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{i + 1}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 600, margin: 0,
                  color: step.done ? '#fff' : 'rgba(255,255,255,0.4)',
                }}>
                  {step.label}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: '2px 0 0', fontWeight: 400 }}>
                  {step.sub}
                </p>
                {/* Mini progress bar for incomplete steps */}
                {!step.done && step.current > 0 && (
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'rgba(244,166,35,0.5)',
                      width: `${Math.min((step.current / step.goal) * 100, 100)}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar red → green */}
        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 14 }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, #ef4444, #f59e0b, #4ade80)`,
            width: `${Math.min((engineLevel / 4) * 100, 100)}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* ─── Diet ─── */}
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

      {/* ─── Antojo de hoy ─── */}
      {antojoDishes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤤</span> Te antojaste hoy
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

      {/* ─── Lo que te gusta (categories as visual chips) ─── */}
      {topCategories.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>
            Lo que te gusta
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topCategories.map(([cat, score]) => {
              const pct = Math.round((score / maxCatScore) * 100)
              const emoji = CATEGORY_EMOJIS[cat] || '🍽'
              return (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{cat}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: '#F4A623',
                        background: 'rgba(244,166,35,0.1)', padding: '2px 6px', borderRadius: 6,
                      }}>
                        {pct >= 80 ? 'Encanta' : pct >= 50 ? 'Gusta mucho' : 'Gusta'}
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: 'linear-gradient(90deg, #F4A623, #f59e0b)',
                        width: `${pct}%`, transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Ingredientes favoritos (as chips) ─── */}
      {topKeywords.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
            Ingredientes favoritos
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topKeywords.map(([kw, score]) => {
              const intensity = Math.min(score / (topKeywords[0]?.[1] ?? 1), 1)
              return (
                <span key={kw} style={{
                  padding: '6px 12px', borderRadius: 16,
                  fontSize: 12, fontWeight: 500,
                  background: `rgba(244,166,35,${0.05 + intensity * 0.12})`,
                  border: `1px solid rgba(244,166,35,${0.1 + intensity * 0.2})`,
                  color: `rgba(255,255,255,${0.4 + intensity * 0.4})`,
                }}>
                  {kw}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Stats ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        <StatCard value={profile.totalInteractions} label="Explorados" icon="👁" />
        <StatCard value={profile.likedDishIds.size} label="Te gustaron" icon="👍" />
        <StatCard value={profile.passedDishIds.size} label="No te gustaron" icon="👎" />
      </div>

      {/* ─── Reset ─── */}
      <button onClick={onReset} style={{
        width: '100%', padding: 14, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer',
      }}>
        Reiniciar mis gustos
      </button>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: 10, marginTop: 6 }}>
        El feed vuelve a ser genérico y empieza a aprender de nuevo
      </p>
    </div>
  )
}

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '14px 10px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 14, margin: '0 0 2px' }}>{icon}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#F4A623', margin: '0 0 2px' }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{label}</p>
    </div>
  )
}
