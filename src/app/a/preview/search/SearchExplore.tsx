'use client'

import { useState, useMemo, useEffect } from 'react'
import type { FeedDish } from '../../types'
import { getDisplayCategories } from '../../lib/categories'
import { extractKeywords } from '../../lib/keywords'
import { distanceKm, formatDistance } from '../../lib/geo'
import MasonryGrid from '../../components/MasonryGrid'

const CATEGORY_ICONS: Record<string, string> = {
  'Pizzas': '🍕', 'Hamburguesas': '🍔', 'Sushi': '🍣',
  'Ceviches & Mariscos': '🐟', 'Ensaladas': '🥗', 'Parrilla & Carnes': '🥩',
  'Sandwiches': '🥪', 'Pastas': '🍝', 'Empanadas': '🥟',
  'Mexicana': '🌮', 'Asiática': '🍜', 'Postres': '🍰',
  'Completos': '🌭', 'Vegano': '🌱',
}

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

  // Sections for explore mode
  const categories = useMemo(() => {
    const display = getDisplayCategories()
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return display.filter(c => available.has(c.norm))
  }, [dishes])

  // Popular
  const popular = useMemo(() =>
    dishes.filter(d => d.fotoUrl).sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 10),
    [dishes]
  )

  // Near you
  const nearYou = useMemo(() => {
    if (!userLocation) return []
    return dishes
      .filter(d => d.fotoUrl && d.restauranteLat && d.restauranteLng)
      .map(d => ({ dish: d, dist: distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
      .map(x => x.dish)
  }, [dishes, userLocation])

  // Para ti (top scored)
  const paraTi = useMemo(() => {
    return dishes.filter(d => d.fotoUrl).map(d => {
      let score = Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.3, 8)
      const kws = extractKeywords(d.nombre, d.descripcion)
      for (const kw of kws) score += Math.min(keywordScores[kw] ?? 0, 3)
      score += Math.random() * 3
      return { dish: d, score }
    }).sort((a, b) => b.score - a.score).slice(0, 10).map(x => x.dish)
  }, [dishes, categoryScores, keywordScores])

  // Per-category sections (top 2 categories from profile)
  const topCatSections = useMemo(() => {
    const top = Object.entries(categoryScores)
      .filter(([, s]) => s >= 8)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([cat]) => cat)
    return top.map(cat => ({
      cat,
      dishes: dishes.filter(d => d.fotoUrl && d.categoriaNorm === cat).slice(0, 10),
    })).filter(s => s.dishes.length >= 3)
  }, [dishes, categoryScores])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh' }}>

      {/* Search bar — fixed */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(14,14,14,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
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
                color: '#fff', fontSize: 14,
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

      {/* Search results */}
      {isSearching ? (
        <div>
          <div style={{ padding: '12px 16px 8px', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{query}"
          </div>
          {searchResults.length > 0 ? (
            <MasonryGrid dishes={searchResults} onDishTap={() => {}} userLocation={userLocation} />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🔍</p>
              <p style={{ fontSize: 14 }}>No encontramos "{query}"</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', marginTop: 4 }}>Intenta con otro nombre</p>
            </div>
          )}
        </div>
      ) : (
        /* Explore sections */
        <div style={{ paddingBottom: 60 }}>

          {/* Popular */}
          <Section title="Populares esta semana" emoji="🔥" dishes={popular} userLocation={userLocation} />

          {/* Near you */}
          {nearYou.length > 0 && (
            <Section title={`Cerca de ti${locationName ? ` en ${locationName}` : ''}`} emoji="📍" dishes={nearYou} userLocation={userLocation} />
          )}

          {/* Para ti */}
          <Section title="Para ti" subtitle="Basado en tus gustos" emoji="✨" dishes={paraTi} userLocation={userLocation} />

          {/* Per-category from profile */}
          {topCatSections.map(s => (
            <Section key={s.cat} title={s.cat} emoji={CATEGORY_ICONS[s.cat] || '🍽'} dishes={s.dishes} userLocation={userLocation} />
          ))}
        </div>
      )}

      {/* Floating buttons */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, display: 'flex', gap: 10, pointerEvents: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <a href="/a" style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(20,20,20,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </a>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(20,20,20,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function Section({ title, subtitle, emoji, dishes, userLocation }: {
  title: string; subtitle?: string; emoji: string
  dishes: FeedDish[]; userLocation: { lat: number; lng: number } | null
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, fontFamily: 'var(--font-feed-display), serif' }}>
            {title}
          </h2>
        </div>
        {subtitle && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0', paddingLeft: 22 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}>
        {dishes.map(dish => {
          let seed = 0
          for (let i = 0; i < dish.id.length; i++) seed = (seed * 31 + dish.id.charCodeAt(i)) & 0xffff
          return (
            <div key={dish.id} style={{
              flexShrink: 0, width: 150, borderRadius: 12, overflow: 'hidden',
              background: 'rgba(255,255,255,0.04)', position: 'relative',
            }}>
              <div style={{ position: 'relative', width: 150, height: 110, overflow: 'hidden' }}>
                <img src={dish.fotoUrl!} alt={dish.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                  padding: '16px 8px 6px',
                }}>
                  <p style={{
                    fontSize: 12, fontWeight: 600, color: '#fff', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{dish.nombre}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#F4A623', fontWeight: 600 }}>
                      ${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}
                    </span>
                    {userLocation && dish.restauranteLat && dish.restauranteLng && (
                      <>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>·</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                          {formatDistance(distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
