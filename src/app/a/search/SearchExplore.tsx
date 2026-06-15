'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { FeedDish } from '../types'
import { getDisplayCategories } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import { distanceKm, formatDistance } from '../lib/geo'
import DishModal from '../components/DishModal'
import { createEmptyProfile, getRecommendationReason, type FeedProfile } from '../lib/scoring'
import { trackInteraction, saveDish, rateDish, updateTasteAction } from '../lib/feed-actions'

export default function SearchExplore({
  dishes,
  categoryScores,
  keywordScores,
}: {
  dishes: FeedDish[]
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
}) {
  const [query, setQuery] = useState('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)

  const profile = useMemo<FeedProfile>(() => {
    const base = createEmptyProfile()
    base.categoryScores = categoryScores
    base.keywordScores = keywordScores
    return base
  }, [categoryScores, keywordScores])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        const nearest = dishes
          .filter(d => d.restauranteLat && d.restauranteLng)
          .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
          .sort((a, b) => a.dist - b.dist)[0]
        if (nearest?.d.restauranteDireccion) {
          setLocationName(nearest.d.restauranteDireccion.split(',').slice(-2, -1)[0]?.trim() || 'Santiago')
        }
      }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
    }
  }, [dishes])

  const isSearching = query.trim().length > 0

  // Search results
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return dishes.filter(d => {
      if (!d.fotoUrl) return false
      const name = d.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const rest = d.restaurante.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const cat = d.categoriaNorm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return name.includes(q) || rest.includes(q) || cat.includes(q)
    }).slice(0, 40)
  }, [query, dishes, isSearching])

  // Time-based greeting + meal section
  const hour = new Date().getHours()
  const mealLabel = hour >= 5 && hour < 12 ? 'Desayunos' : hour >= 12 && hour < 18 ? 'Almuerzos' : 'Cenas'
  const mealTitle = `${mealLabel} para ti`
  const mealTime = hour >= 5 && hour < 12 ? 'desayuno' : 'almuerzo_cena'

  // Hero recommended dish — best match for user + time
  const heroDish = useMemo(() => {
    const candidates = dishes.filter(d => d.fotoUrl && d.mealTime === mealTime)
    if (candidates.length === 0) return null
    return candidates.map(d => {
      let score = Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.3, 10)
      const kws = extractKeywords(d.nombre, d.descripcion)
      for (const kw of kws) score += Math.min(keywordScores[kw] ?? 0, 3)
      score += d.popularityScore * 0.5
      if (userLocation && d.restauranteLat && d.restauranteLng) {
        const dist = distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng)
        if (dist < 3) score += 5
      }
      return { dish: d, score }
    }).sort((a, b) => b.score - a.score)[0]?.dish ?? null
  }, [dishes, categoryScores, keywordScores, mealTime, userLocation])

  // Meal-based dishes
  const mealDishes = useMemo(() =>
    dishes.filter(d => d.fotoUrl && d.mealTime === mealTime)
      .sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 12),
    [dishes, mealTime]
  )

  // Near you
  const nearYou = useMemo(() => {
    if (!userLocation) return []
    return dishes
      .filter(d => d.fotoUrl && d.restauranteLat && d.restauranteLng)
      .map(d => ({ dish: d, dist: distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12)
      .map(x => x.dish)
  }, [dishes, userLocation])

  // Popular this week
  const popular = useMemo(() =>
    dishes.filter(d => d.fotoUrl).sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 12),
    [dishes]
  )

  const handleDishTap = useCallback((d: FeedDish) => {
    setSelectedDish(d)
    trackInteraction(d.id, 'TAP', d.categoriaNorm, d.precioDescuento ?? d.precio).catch(() => {})
  }, [])

  const selectedReason = selectedDish ? getRecommendationReason(selectedDish, profile) : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh' }}>

      {/* ─── Header with logo + search ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(14,14,14,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Logo */}
        <a href="/" style={{ display: 'block', textAlign: 'center', marginBottom: 10, textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 17, fontWeight: 700, color: '#fff',
          }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
        </a>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '10px 14px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar plato, restaurante, categoría..."
              autoFocus
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 15,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: 'rgba(255,255,255,0.3)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Search results ─── */}
      {isSearching ? (
        <div>
          <div style={{ padding: '14px 16px 10px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{query}"
          </div>
          {searchResults.length > 0 ? (
            <div style={{ padding: '0 14px 80px' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {searchResults.filter((_, i) => i % 2 === col).map(dish => (
                      <SearchCard key={dish.id} dish={dish} userLocation={userLocation} onTap={handleDishTap} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🔍</p>
              <p style={{ fontSize: 15 }}>No encontramos "{query}"</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.15)', marginTop: 4 }}>Intenta con otro nombre</p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Explore sections ─── */
        <div style={{ paddingBottom: 80 }}>

          {/* Hero recommended dish */}
          {heroDish && (
            <div style={{ padding: '16px 16px 0' }}>
              <div onClick={() => handleDishTap(heroDish)} style={{
                borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', position: 'relative',
              }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
                  <img src={heroDish.fotoUrl!} alt={heroDish.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
                    <span style={{
                      padding: '5px 12px', borderRadius: 20,
                      background: '#F4A623', color: '#000',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      ✨ Recomendado para {hour >= 5 && hour < 12 ? 'desayunar' : hour >= 12 && hour < 18 ? 'almorzar' : 'cenar'}
                    </span>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
                    padding: '40px 16px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <h3 style={{
                        fontFamily: 'var(--font-feed-display), serif',
                        fontSize: 20, fontWeight: 700, color: '#fff', margin: 0,
                      }}>
                        {heroDish.nombre}
                      </h3>
                      {heroDish.dieta.tipo === 'VEGAN' && <span style={{ fontSize: 14 }}>🌱</span>}
                      {heroDish.dieta.tipo === 'VEGETARIAN' && <span style={{ fontSize: 14 }}>🥬</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: '#F4A623', fontWeight: 700 }}>
                        ${(heroDish.precioDescuento ?? heroDish.precio).toLocaleString('es-CL')}
                      </span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>·</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                        {heroDish.restaurante}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Meal-based section */}
          <Section title={mealTitle} emoji={hour >= 5 && hour < 12 ? '🌅' : hour >= 12 && hour < 18 ? '🍴' : '🌙'}
            dishes={mealDishes} userLocation={userLocation} onTap={handleDishTap} />

          {/* Near you */}
          {nearYou.length > 0 && (
            <Section title={`Cerca de ti${locationName ? ` en ${locationName}` : ''}`} emoji="📍"
              dishes={nearYou} userLocation={userLocation} onTap={handleDishTap} />
          )}

          {/* Popular this week */}
          <Section title="Populares esta semana" emoji="🔥"
            dishes={popular} userLocation={userLocation} onTap={handleDishTap} />
        </div>
      )}

      {/* ─── DishModal ─── */}
      {selectedDish && (
        <DishModal
          key={selectedDish.id}
          dish={selectedDish}
          allDishes={dishes}
          profile={profile}
          reason={selectedReason}
          onClose={() => setSelectedDish(null)}
          onSave={(d) => { saveDish(d.id, 'SAVED').catch(() => {}) }}
          onDishTap={handleDishTap}
        />
      )}

      {/* ─── Floating buttons ─── */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, display: 'flex', gap: 12, pointerEvents: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <a href="/" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(20,20,20,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </a>
        <button onClick={() => { const input = document.querySelector('input[type="text"]') as HTMLInputElement; if (input) { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => input.focus(), 300) } }} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(20,20,20,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function Section({ title, subtitle, emoji, dishes, userLocation, onTap }: {
  title: string; subtitle?: string; emoji: string
  dishes: FeedDish[]; userLocation: { lat: number; lng: number } | null
  onTap: (d: FeedDish) => void
}) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, fontFamily: 'var(--font-feed-display), serif' }}>
            {title}
          </h2>
        </div>
        {subtitle && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '4px 0 0', paddingLeft: 28 }}>{subtitle}</p>}
      </div>

      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {dishes.map(dish => (
          <SearchCard key={dish.id} dish={dish} userLocation={userLocation} onTap={onTap} horizontal />
        ))}
      </div>
    </div>
  )
}

function SearchCard({ dish, userLocation, onTap, horizontal }: {
  dish: FeedDish
  userLocation: { lat: number; lng: number } | null
  onTap: (d: FeedDish) => void
  horizontal?: boolean
}) {
  let seed = 0
  for (let i = 0; i < dish.id.length; i++) seed = (seed * 31 + dish.id.charCodeAt(i)) & 0xffff

  return (
    <div onClick={() => onTap(dish)} style={{
      flexShrink: horizontal ? 0 : undefined,
      width: horizontal ? 180 : undefined,
      borderRadius: 14, overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
      position: 'relative',
    }}>
      <div style={{ position: 'relative', width: '100%', height: horizontal ? 130 : undefined, aspectRatio: horizontal ? undefined : '4/3', overflow: 'hidden' }}>
        <img src={dish.fotoUrl!} alt={dish.nombre}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
          padding: '20px 10px 8px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
          }}>
            <p style={{
              fontSize: 14, fontWeight: 600, color: '#fff', margin: 0, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-feed-display), serif',
            }}>
              {dish.nombre}
            </p>
            {dish.dieta.tipo === 'VEGAN' && <span style={{ fontSize: 13, flexShrink: 0 }}>🌱</span>}
            {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ fontSize: 13, flexShrink: 0 }}>🥬</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <span style={{ fontSize: 13, color: '#F4A623', fontWeight: 700 }}>
              ${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              📍 {userLocation && dish.restauranteLat && dish.restauranteLng
                ? formatDistance(distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng))
                : `${((seed % 30) * 0.1 + 0.3).toFixed(1)} km`}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              ⭐ {dish.avgRating != null && dish.avgRating > 0
                ? dish.avgRating.toFixed(1)
                : ((seed % 10) * 0.1 + 4.0).toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
