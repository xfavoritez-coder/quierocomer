'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { FeedDish } from '../types'
import { getDisplayCategories } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import { distanceKm, formatDistance } from '../lib/geo'
import { applyFilters, type Filters } from '../components/FeedFilters'
import MasonryGrid from '../components/MasonryGrid'

const CATEGORY_ICONS: Record<string, string> = {
  'Pizzas': '🍕', 'Hamburguesas': '🍔', 'Sushi': '🍣',
  'Ceviches & Mariscos': '🐟', 'Ensaladas': '🥗', 'Parrilla & Carnes': '🥩',
  'Sandwiches': '🥪', 'Pastas': '🍝', 'Empanadas': '🥟',
  'Mexicana': '🌮', 'Asiática': '🍜', 'Postres': '🍰',
  'Completos': '🌭', 'Vegano': '🌱',
}

export default function NewHome({
  dishes,
  categoryScores,
  keywordScores,
  totalInteractions,
}: {
  dishes: FeedDish[]
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
}) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeDishType, setActiveDishType] = useState<string | null>('food')
  const [sessionLikedIds, setSessionLikedIds] = useState<Set<string>>(new Set())
  const [sessionDislikedIds, setSessionDislikedIds] = useState<Set<string>>(new Set())
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(20)

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 && visibleCount < feedDishes.length) {
        setVisibleCount(prev => Math.min(prev + 20, feedDishes.length))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, feedDishes.length])

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
          const commune = nearest.d.restauranteDireccion.split(',').slice(-2, -1)[0]?.trim()
          setLocationName(commune || 'Santiago')
        }
      }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
    }
  }, [dishes])

  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'desayunar' : hour >= 12 && hour < 18 ? 'almorzar' : 'cenar'

  const categories = useMemo(() => {
    const display = getDisplayCategories()
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return display.filter(c => available.has(c)).slice(0, 8)
  }, [dishes])

  // Dish type filter
  const DISH_TYPES: { id: string; label: string; matches: string[] }[] = [
    { id: 'food', label: '🍽 Platos', matches: ['food', 'entry'] },
    { id: 'dessert', label: '🍰 Postres', matches: ['dessert'] },
    { id: 'drink', label: '🍹 Bebidas', matches: ['drink', 'coffee'] },
  ]

  // Filter + score dishes
  const feedDishes = useMemo(() => {
    let filtered = dishes.filter(d => d.fotoUrl)

    // Dish type filter
    if (activeDishType) {
      const dt = DISH_TYPES.find(t => t.id === activeDishType)
      if (dt && dt.matches.length > 0) {
        const matchSet = new Set(dt.matches)
        filtered = filtered.filter(d => matchSet.has(d.categoriaTipo))
      }
    }

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter(d => d.categoriaNorm === activeCategory)
    }

    // Remove disliked
    filtered = filtered.filter(d => !sessionDislikedIds.has(d.id))

    // Build keyword scores
    const mergedKw: Record<string, number> = { ...keywordScores }
    for (const d of dishes) {
      const kws = extractKeywords(d.nombre, d.descripcion)
      if (sessionLikedIds.has(d.id)) for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) + 8
      if (sessionDislikedIds.has(d.id)) for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) - 12
    }

    // Score
    const scored = filtered.map(d => {
      let score = 0
      score += Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
      const kws = extractKeywords(d.nombre, d.descripcion)
      let kwTotal = 0
      for (const kw of kws) kwTotal += (mergedKw[kw] ?? 0)
      score += Math.min(kwTotal, 10)
      return { dish: d, score }
    })

    scored.sort((a, b) => b.score - a.score)

    // 70/15/15 mix
    const total = scored.length
    const scoredCount = Math.ceil(total * 0.7)
    const popularCount = Math.ceil(total * 0.15)
    const topScored = scored.slice(0, scoredCount)
    const topIds = new Set(topScored.map(s => s.dish.id))
    const popular = scored.filter(s => !topIds.has(s.dish.id)).sort((a, b) => b.dish.popularityScore - a.dish.popularityScore).slice(0, popularCount)
    const usedIds = new Set([...topIds, ...popular.map(p => p.dish.id)])
    const discovery = scored.filter(s => !usedIds.has(s.dish.id)).sort(() => Math.random() - 0.5)

    const result: FeedDish[] = []
    let sI = 0, pI = 0, dI = 0
    for (let i = 0; i < total; i++) {
      if (i % 7 === 5 && pI < popular.length) result.push(popular[pI++].dish)
      else if (i % 7 === 6 && dI < discovery.length) result.push(discovery[dI++].dish)
      else if (sI < topScored.length) result.push(topScored[sI++].dish)
      else if (pI < popular.length) result.push(popular[pI++].dish)
      else if (dI < discovery.length) result.push(discovery[dI++].dish)
    }

    // Max 3 consecutive same category
    const final: FeedDish[] = []
    const rem = [...result]
    while (rem.length > 0) {
      const recent = final.slice(-3).map(d => d.categoriaNorm)
      const allSame = recent.length === 3 && recent.every(c => c === recent[0])
      if (allSame) {
        const diffIdx = rem.findIndex(d => d.categoriaNorm !== recent[0])
        if (diffIdx >= 0) { final.push(rem.splice(diffIdx, 1)[0]); continue }
      }
      final.push(rem.shift()!)
    }
    return final
  }, [dishes, activeDishType, activeCategory, categoryScores, keywordScores, sessionLikedIds, sessionDislikedIds])

  const handleLike = useCallback((dish: FeedDish) => {
    setSessionLikedIds(prev => new Set([...prev, dish.id]))
    setSessionDislikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
  }, [])

  const handleDislike = useCallback((dish: FeedDish) => {
    setSessionDislikedIds(prev => new Set([...prev, dish.id]))
    setSessionLikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
  }, [])

  const handleUndo = useCallback((dish: FeedDish) => {
    setSessionDislikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
    setSessionLikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
  }, [])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh' }}>

      {/* Logo header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/genio-lamp.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 17, fontWeight: 700, color: '#fff' }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
        </div>
        <button onClick={() => setMenuOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.5)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Hamburger menu slide-in */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
            width: 260, maxWidth: '75vw',
            background: '#141414', borderLeft: '1px solid rgba(255,255,255,0.06)',
            padding: '60px 20px 40px', display: 'flex', flexDirection: 'column', gap: 4,
            animation: 'slideRight 0.2s ease-out',
          }}>
            <button onClick={() => setMenuOpen(false)} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {[
              { label: '🏠 Inicio', href: '/a' },
              { label: '🔍 Buscar', href: '/a/search' },
              { label: '💛 Favoritos', href: '#' },
              { label: '👤 Mi perfil', href: '#' },
            ].map((item, i) => (
              <a key={i} href={item.href} style={{
                display: 'block', padding: '14px 16px', borderRadius: 12, fontSize: 15, fontWeight: 500,
                color: '#fff', textDecoration: 'none', background: 'rgba(255,255,255,0.03)',
              }}>
                {item.label}
              </a>
            ))}
          </div>
        </>
      )}

      {/* Greeting */}
      <div style={{ padding: '14px 20px 0' }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          Descubre qué comer
        </p>
      </div>

      {/* Location + Search */}
      <div style={{ padding: '14px 20px', display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {locationName ? `${locationName} · 3 km` : 'Activar ubicación'}
          </span>
        </div>
        <button style={{
          padding: '10px 18px', borderRadius: 12,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          Buscar
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8 }}>
        {DISH_TYPES.map(t => (
          <button key={t.id} onClick={() => setActiveDishType(activeDishType === t.id ? 'food' : t.id)} style={{
            padding: '9px 18px', borderRadius: 22, fontSize: 13, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: activeDishType === t.id ? '#F4A623' : 'rgba(255,255,255,0.06)',
            color: activeDishType === t.id ? '#000' : 'rgba(255,255,255,0.5)',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ¿Qué se te antoja? */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Categorías
          </h2>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <CategoryCircle icon="🔥" label="Tendencia" active={!activeCategory} onClick={() => setActiveCategory(null)} />
            {categories.map(cat => (
              <CategoryCircle key={cat} icon={CATEGORY_ICONS[cat] || '🍽'} label={cat.split('&')[0].trim().split(' ')[0]}
                active={activeCategory === cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)} />
            ))}
          </div>
          {/* Fade right */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 4, width: 40,
            background: 'linear-gradient(to left, #0e0e0e, transparent)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* Feed title */}
      <div style={{ padding: '4px 20px 12px' }}>
        <h2 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 18, fontWeight: 700, color: '#fff', margin: 0,
        }}>
          ¿Qué se te antoja?
        </h2>
      </div>

      {/* Feed masonry */}
      <MasonryGrid
        dishes={feedDishes.slice(0, visibleCount)}
        onDishTap={(d) => setSelectedDish(d)}
        onDishLike={handleLike}
        onDishDislike={handleDislike}
        onDishUndo={handleUndo}
        userLocation={userLocation}
      />

      {/* Floating buttons — Pinterest style */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, display: 'flex', gap: 10, pointerEvents: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Inicio" style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(20,20,20,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        <a href="/a/search" style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(20,20,20,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function CategoryCircle({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: active ? 'rgba(244,166,35,0.15)' : 'rgba(255,255,255,0.05)',
        border: active ? '2px solid #F4A623' : '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, transition: 'all 0.2s',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, color: active ? '#F4A623' : 'rgba(255,255,255,0.45)', fontWeight: active ? 600 : 500 }}>{label}</span>
    </button>
  )
}
